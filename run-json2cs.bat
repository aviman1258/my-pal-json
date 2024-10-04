@echo off
:: Prompt the user to select a JSON file via File Explorer
for /f "delims=" %%i in ('powershell -command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'JSON Files (*.json)|*.json'; $f.ShowDialog() | Out-Null; $f.FileName"') do set jsonFile=%%i

:: Check if a file was selected
if "%jsonFile%"=="" (
    echo No file selected. Exiting.
    pause
    exit /b
)

:: Run json-2-tree.py to generate tree_output_keys_only.txt
python json-2-tree.py "%jsonFile%"

:: Run json-2-csharp-model.py to generate C# files
python json-2-csharp-model.py "%jsonFile%"

set outputFolder = %~n1jsonFile%

echo %outputFolder%

pause

:: Capture the output directory from the json-2-csharp-model.py script
set outputDir=csharp-model\outputFolder
 
:: Move the tree_output_keys_only.txt to the C# output directory
move "tree_output_keys_only.txt" "%outputDir%"

:: Open the folder where the .cs files and tree output are saved
start "" "%outputDir%"

pause
