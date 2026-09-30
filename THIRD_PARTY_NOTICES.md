# Third-party notices

Script Launcher uses open-source software. The project's MIT license does not
replace the licenses of its dependencies or bundled third-party assets.

Major dependencies include:

| Component | License | Source |
| --- | --- | --- |
| Wails | MIT | https://github.com/wailsapp/wails |
| go-toast (Windows system notifications) | MIT OR Unlicense | https://git.sr.ht/~jackmordaunt/go-toast |
| React | MIT | https://github.com/facebook/react |
| Vite | MIT | https://github.com/vitejs/vite |
| Tailwind CSS | MIT | https://github.com/tailwindlabs/tailwindcss |
| Radix UI | MIT | https://github.com/radix-ui/primitives |
| Zustand | MIT | https://github.com/pmndrs/zustand |
| Lucide React | ISC | https://github.com/lucide-icons/lucide |
| emoji-picker-react | MIT | https://github.com/ealush/emoji-picker-react |
| modernc.org/sqlite | BSD-3-Clause | https://gitlab.com/cznic/sqlite |

Exact dependency versions and transitive dependencies are recorded in `go.mod`,
`go.sum`, `frontend/package.json`, and `frontend/pnpm-lock.yaml`. Refer to each
dependency's own license and copyright notices when redistributing it.

## go-toast

Windows system notifications use go-toast under its MIT license.

Copyright (c) 2023 Jack Mordaunt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Inter font

Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter).
The bundled Inter font is licensed under the SIL Open Font License 1.1.
The complete license is preserved in `frontend/Inter Font License.txt` and
included with the DMG and EXE distributions.
