package main

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type LauncherService struct {
	db           *sql.DB
	app          *application.App
	executionsMu sync.Mutex
	executions   map[int64]*runningExecution
}

func NewLauncherService() (*LauncherService, error) {
	path, err := defaultDatabasePath()
	if err != nil {
		return nil, err
	}
	return NewLauncherServiceAt(path)
}

func NewLauncherServiceAt(path string) (*LauncherService, error) {
	db, err := openDatabase(path)
	if err != nil {
		return nil, err
	}
	return &LauncherService{db: db, executions: make(map[int64]*runningExecution)}, nil
}

func (s *LauncherService) setApp(app *application.App) {
	s.app = app
}

func (s *LauncherService) close() error {
	s.stopAllExecutions()
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

func nowString() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func (s *LauncherService) GetState() (AppState, error) {
	state := AppState{
		Groups:   []Group{},
		Entries:  []Entry{},
		Settings: []Setting{},
	}

	groupRows, err := s.db.Query(`
		SELECT id, name, icon, sort_order, created_at, updated_at
		FROM groups ORDER BY sort_order, id
	`)
	if err != nil {
		return state, err
	}
	for groupRows.Next() {
		var group Group
		if err := groupRows.Scan(&group.ID, &group.Name, &group.Icon, &group.SortOrder, &group.CreatedAt, &group.UpdatedAt); err != nil {
			groupRows.Close()
			return state, err
		}
		state.Groups = append(state.Groups, group)
	}
	if err := groupRows.Close(); err != nil {
		return state, err
	}

	entryRows, err := s.db.Query(`
		SELECT id, group_id, name, icon, script_path, working_directory, arguments,
		       show_terminal, sort_order, click_count, last_clicked_at, created_at, updated_at
		FROM entries ORDER BY group_id, sort_order, id
	`)
	if err != nil {
		return state, err
	}
	for entryRows.Next() {
		var entry Entry
		if err := entryRows.Scan(
			&entry.ID, &entry.GroupID, &entry.Name, &entry.Icon, &entry.ScriptPath,
			&entry.WorkingDirectory, &entry.Arguments, &entry.ShowTerminal, &entry.SortOrder,
			&entry.ClickCount, &entry.LastClickedAt,
			&entry.CreatedAt, &entry.UpdatedAt,
		); err != nil {
			entryRows.Close()
			return state, err
		}
		state.Entries = append(state.Entries, entry)
	}
	if err := entryRows.Close(); err != nil {
		return state, err
	}

	settingRows, err := s.db.Query("SELECT key, value FROM settings ORDER BY key")
	if err != nil {
		return state, err
	}
	defer settingRows.Close()
	for settingRows.Next() {
		var setting Setting
		if err := settingRows.Scan(&setting.Key, &setting.Value); err != nil {
			return state, err
		}
		state.Settings = append(state.Settings, setting)
	}
	return state, settingRows.Err()
}

func (s *LauncherService) CreateGroup(input GroupInput) (Group, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Icon = strings.TrimSpace(input.Icon)
	if input.Name == "" {
		return Group{}, errors.New("分组名称不能为空")
	}
	if input.Icon == "" {
		input.Icon = "Folder"
	}
	var sortOrder int
	if err := s.db.QueryRow("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM groups").Scan(&sortOrder); err != nil {
		return Group{}, err
	}
	now := nowString()
	result, err := s.db.Exec(
		"INSERT INTO groups(name, icon, sort_order, created_at, updated_at) VALUES(?, ?, ?, ?, ?)",
		input.Name, input.Icon, sortOrder, now, now,
	)
	if err != nil {
		return Group{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Group{}, err
	}
	return Group{ID: id, Name: input.Name, Icon: input.Icon, SortOrder: sortOrder, CreatedAt: now, UpdatedAt: now}, nil
}

func (s *LauncherService) UpdateGroup(id int64, input GroupInput) (Group, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Icon = strings.TrimSpace(input.Icon)
	if input.Name == "" {
		return Group{}, errors.New("分组名称不能为空")
	}
	if input.Icon == "" {
		input.Icon = "Folder"
	}
	now := nowString()
	result, err := s.db.Exec("UPDATE groups SET name = ?, icon = ?, updated_at = ? WHERE id = ?", input.Name, input.Icon, now, id)
	if err != nil {
		return Group{}, err
	}
	if err := requireAffected(result, "分组不存在"); err != nil {
		return Group{}, err
	}
	var group Group
	err = s.db.QueryRow(
		"SELECT id, name, icon, sort_order, created_at, updated_at FROM groups WHERE id = ?", id,
	).Scan(&group.ID, &group.Name, &group.Icon, &group.SortOrder, &group.CreatedAt, &group.UpdatedAt)
	return group, err
}

func (s *LauncherService) DeleteGroup(id int64) error {
	result, err := s.db.Exec("DELETE FROM groups WHERE id = ?", id)
	if err != nil {
		return err
	}
	return requireAffected(result, "分组不存在")
}

func (s *LauncherService) ReorderGroups(orderedIDs []int64) error {
	return s.reorder("groups", 0, orderedIDs)
}

func (s *LauncherService) CreateEntry(input EntryInput) (Entry, error) {
	input, err := s.validateEntryInput(input)
	if err != nil {
		return Entry{}, err
	}
	var sortOrder int
	if err := s.db.QueryRow(
		"SELECT COALESCE(MAX(sort_order), -1) + 1 FROM entries WHERE group_id = ?", input.GroupID,
	).Scan(&sortOrder); err != nil {
		return Entry{}, err
	}
	now := nowString()
	result, err := s.db.Exec(`
		INSERT INTO entries(
			group_id, name, icon, script_path, working_directory, arguments,
			show_terminal, sort_order, created_at, updated_at
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, input.GroupID, input.Name, input.Icon, input.ScriptPath, input.WorkingDirectory,
		input.Arguments, input.ShowTerminal, sortOrder, now, now)
	if err != nil {
		return Entry{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		ID: id, GroupID: input.GroupID, Name: input.Name, Icon: input.Icon,
		ScriptPath: input.ScriptPath, WorkingDirectory: input.WorkingDirectory,
		Arguments: input.Arguments, ShowTerminal: input.ShowTerminal,
		SortOrder: sortOrder, ClickCount: 0, LastClickedAt: "", CreatedAt: now, UpdatedAt: now,
	}, nil
}

func (s *LauncherService) UpdateEntry(id int64, input EntryInput) (Entry, error) {
	input, err := s.validateEntryInput(input)
	if err != nil {
		return Entry{}, err
	}
	var oldGroupID int64
	var oldSortOrder int
	if err := s.db.QueryRow("SELECT group_id, sort_order FROM entries WHERE id = ?", id).Scan(&oldGroupID, &oldSortOrder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Entry{}, errors.New("入口不存在")
		}
		return Entry{}, err
	}
	sortOrder := oldSortOrder
	if oldGroupID != input.GroupID {
		if err := s.db.QueryRow(
			"SELECT COALESCE(MAX(sort_order), -1) + 1 FROM entries WHERE group_id = ?", input.GroupID,
		).Scan(&sortOrder); err != nil {
			return Entry{}, err
		}
	}
	now := nowString()
	_, err = s.db.Exec(`
		UPDATE entries SET
			group_id = ?, name = ?, icon = ?, script_path = ?, working_directory = ?,
			arguments = ?, show_terminal = ?, sort_order = ?, updated_at = ?
		WHERE id = ?
	`, input.GroupID, input.Name, input.Icon, input.ScriptPath, input.WorkingDirectory,
		input.Arguments, input.ShowTerminal, sortOrder, now, id)
	if err != nil {
		return Entry{}, err
	}
	return s.getEntry(id)
}

func (s *LauncherService) DeleteEntry(id int64) error {
	result, err := s.db.Exec("DELETE FROM entries WHERE id = ?", id)
	if err != nil {
		return err
	}
	return requireAffected(result, "入口不存在")
}

func (s *LauncherService) MoveEntry(id int64, targetGroupID int64) (Entry, error) {
	entry, err := s.getEntry(id)
	if err != nil {
		return Entry{}, err
	}
	if entry.GroupID == targetGroupID {
		return entry, nil
	}
	if err := s.requireGroup(targetGroupID); err != nil {
		return Entry{}, err
	}
	var sortOrder int
	if err := s.db.QueryRow(
		"SELECT COALESCE(MAX(sort_order), -1) + 1 FROM entries WHERE group_id = ?", targetGroupID,
	).Scan(&sortOrder); err != nil {
		return Entry{}, err
	}
	_, err = s.db.Exec(
		"UPDATE entries SET group_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
		targetGroupID, sortOrder, nowString(), id,
	)
	if err != nil {
		return Entry{}, err
	}
	return s.getEntry(id)
}

func (s *LauncherService) ReorderEntries(groupID int64, orderedIDs []int64) error {
	if err := s.requireGroup(groupID); err != nil {
		return err
	}
	return s.reorder("entries", groupID, orderedIDs)
}

func (s *LauncherService) SelectScript() (string, error) {
	if s.app == nil {
		return "", errors.New("文件选择器尚未就绪")
	}
	return s.app.Dialog.OpenFile().
		SetTitle("选择脚本或程序").
		AddFilter("支持的脚本与程序", "*.sh;*.bash;*.zsh;*.py;*.js;*.mjs;*.cjs;*.ps1;*.bat;*.cmd;*.exe;*.app").
		AddFilter("所有文件", "*.*").
		PromptForSingleSelection()
}

func (s *LauncherService) SelectDirectory() (string, error) {
	if s.app == nil {
		return "", errors.New("文件选择器尚未就绪")
	}
	return s.app.Dialog.OpenFile().
		SetTitle("选择工作目录").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
}

func (s *LauncherService) SelectIconImage() (string, error) {
	if s.app == nil {
		return "", errors.New("文件选择器尚未就绪")
	}
	path, err := s.app.Dialog.OpenFile().
		SetTitle("选择自定义图标").
		AddFilter("图片", "*.png;*.jpg;*.jpeg;*.webp;*.gif").
		PromptForSingleSelection()
	if err != nil || path == "" {
		return "", err
	}
	return encodeIconDataURL(path)
}

func (s *LauncherService) RevealEntry(id int64) error {
	entry, err := s.getEntry(id)
	if err != nil {
		return err
	}
	path, err := resolveEntryPath(entry)
	if err != nil {
		return err
	}
	if err := revealInFileManager(path); err != nil {
		return fmt.Errorf("无法在文件管理器中打开：%w", err)
	}
	return nil
}

func (s *LauncherService) validateEntryInput(input EntryInput) (EntryInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Icon = strings.TrimSpace(input.Icon)
	input.ScriptPath = strings.TrimSpace(input.ScriptPath)
	input.WorkingDirectory = strings.TrimSpace(input.WorkingDirectory)
	input.Arguments = strings.TrimSpace(input.Arguments)
	if input.Name == "" {
		return input, errors.New("入口名称不能为空")
	}
	if input.ScriptPath == "" {
		return input, errors.New("脚本路径或命令不能为空")
	}
	if input.Icon == "" {
		input.Icon = "Terminal"
	}
	if err := s.requireGroup(input.GroupID); err != nil {
		return input, err
	}
	return input, nil
}

func (s *LauncherService) requireGroup(id int64) error {
	var exists int
	if err := s.db.QueryRow("SELECT 1 FROM groups WHERE id = ?", id).Scan(&exists); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("所属分组不存在")
		}
		return err
	}
	return nil
}

func (s *LauncherService) getEntry(id int64) (Entry, error) {
	var entry Entry
	err := s.db.QueryRow(`
		SELECT id, group_id, name, icon, script_path, working_directory, arguments,
		       show_terminal, sort_order, click_count, last_clicked_at, created_at, updated_at
		FROM entries WHERE id = ?
	`, id).Scan(
		&entry.ID, &entry.GroupID, &entry.Name, &entry.Icon, &entry.ScriptPath,
		&entry.WorkingDirectory, &entry.Arguments, &entry.ShowTerminal,
		&entry.SortOrder, &entry.ClickCount, &entry.LastClickedAt,
		&entry.CreatedAt, &entry.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Entry{}, errors.New("入口不存在")
	}
	return entry, err
}

func (s *LauncherService) recordEntryClick(id int64, clickedAt string) error {
	result, err := s.db.Exec(`
		UPDATE entries
		SET click_count = click_count + 1, last_clicked_at = ?
		WHERE id = ?
	`, clickedAt, id)
	if err != nil {
		return err
	}
	return requireAffected(result, "入口不存在")
}

func (s *LauncherService) reorder(table string, groupID int64, orderedIDs []int64) error {
	if table != "groups" && table != "entries" {
		return errors.New("不支持的排序类型")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var rows *sql.Rows
	if table == "entries" {
		rows, err = tx.Query("SELECT id FROM entries WHERE group_id = ? ORDER BY sort_order, id", groupID)
	} else {
		rows, err = tx.Query("SELECT id FROM groups ORDER BY sort_order, id")
	}
	if err != nil {
		return err
	}
	currentIDs := make([]int64, 0)
	allowed := make(map[int64]bool)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		currentIDs = append(currentIDs, id)
		allowed[id] = true
	}
	if err := rows.Close(); err != nil {
		return err
	}

	mergedIDs := make([]int64, 0, len(currentIDs))
	seen := make(map[int64]bool)
	for _, id := range orderedIDs {
		if !allowed[id] {
			return errors.New("排序项目不存在或不属于当前分组")
		}
		if seen[id] {
			return errors.New("排序列表中存在重复项目")
		}
		seen[id] = true
		mergedIDs = append(mergedIDs, id)
	}
	for _, id := range currentIDs {
		if !seen[id] {
			mergedIDs = append(mergedIDs, id)
		}
	}

	query := fmt.Sprintf("UPDATE %s SET sort_order = ?, updated_at = ? WHERE id = ?", table)
	if table == "entries" {
		query += " AND group_id = ?"
	}
	now := nowString()
	for index, id := range mergedIDs {
		var result sql.Result
		if table == "entries" {
			result, err = tx.Exec(query, index, now, id, groupID)
		} else {
			result, err = tx.Exec(query, index, now, id)
		}
		if err != nil {
			return err
		}
		if err := requireAffected(result, "排序项目不存在或不属于当前分组"); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func requireAffected(result sql.Result, message string) error {
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New(message)
	}
	return nil
}
