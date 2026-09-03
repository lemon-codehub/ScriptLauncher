package main

type Group struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type Entry struct {
	ID               int64  `json:"id"`
	GroupID          int64  `json:"groupId"`
	Name             string `json:"name"`
	Icon             string `json:"icon"`
	ScriptPath       string `json:"scriptPath"`
	WorkingDirectory string `json:"workingDirectory"`
	Arguments        string `json:"arguments"`
	ShowTerminal     bool   `json:"showTerminal"`
	SortOrder        int    `json:"sortOrder"`
	ClickCount       int64  `json:"clickCount"`
	LastClickedAt    string `json:"lastClickedAt"`
	CreatedAt        string `json:"createdAt"`
	UpdatedAt        string `json:"updatedAt"`
}

type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type AppState struct {
	Groups   []Group   `json:"groups"`
	Entries  []Entry   `json:"entries"`
	Settings []Setting `json:"settings"`
}

type GroupInput struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
}

type EntryInput struct {
	GroupID          int64  `json:"groupId"`
	Name             string `json:"name"`
	Icon             string `json:"icon"`
	ScriptPath       string `json:"scriptPath"`
	WorkingDirectory string `json:"workingDirectory"`
	Arguments        string `json:"arguments"`
	ShowTerminal     bool   `json:"showTerminal"`
}

type ExecutionResult struct {
	EntryID    int64  `json:"entryId"`
	Status     string `json:"status"`
	Message    string `json:"message"`
	Output     string `json:"output"`
	Error      string `json:"error"`
	ExitCode   int    `json:"exitCode"`
	StartedAt  string `json:"startedAt"`
	EndedAt    string `json:"endedAt"`
	DurationMS int64  `json:"durationMs"`
}

type ExecutionEvent struct {
	EntryID    int64  `json:"entryId"`
	EntryName  string `json:"entryName"`
	Kind       string `json:"kind"`
	Stream     string `json:"stream"`
	Text       string `json:"text"`
	Status     string `json:"status"`
	Error      string `json:"error"`
	ExitCode   int    `json:"exitCode"`
	Timestamp  string `json:"timestamp"`
	DurationMS int64  `json:"durationMs"`
}
