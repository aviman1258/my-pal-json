@echo off
:: Prompt the user to select a JSON file via File Explorer
for /f "delims=" %%i in ('powershell -command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'JSON Files (*.json)|*.json'; $f.ShowDialog() | Out-Null; $f.FileName"') do set jsonFile=%%i

:: Check if a file was selected
if "%jsonFile%"=="" (
    echo No file selected. Exiting.
    pause
    exit /b
)

:: Run json-2-csharp-model.py to generate C# files
python json-2-csharp-model.py "%jsonFile%"


:: Run json-2-tree.py to generate tree_output_keys_only.txt
python json-2-tree.py "%jsonFile%"


rem Extract the filename without the extension from the full path
for %%F in (%jsonFile%) do set outputFolder=%%~nF

:: Capture the output directory from the json-2-csharp-model.py script
set outputDir=csharp-model\%outputFolder%

:: Create the 'tree' folder in the output directory if it doesn't exist
mkdir "%outputDir%\tree"
 
:: Move the tree_output_keys_only.txt to the 'tree' folder inside the C# output directory
move "schema-tree.txt" "%outputDir%\tree"

:: Open the folder where the .cs files and tree output are saved
start "" "%outputDir%"
