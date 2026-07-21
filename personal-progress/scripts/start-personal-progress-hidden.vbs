Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptsFolder = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = scriptsFolder & "\start-personal-progress.cmd"
shell.Run "cmd.exe /c " & Chr(34) & launcher & Chr(34), 0, False
