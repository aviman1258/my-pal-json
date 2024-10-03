@echo off
:: Prompt the user to press a key to open File Explorer to select a JSON file
echo Press any key to open File Explorer and select the JSON file to analyze.
pause >nul

:: Use PowerShell to open a File Explorer dialog for selecting a JSON file
for /f "delims=" %%i in ('powershell -command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'JSON Files (*.json)|*.json'; $f.ShowDialog() | Out-Null; $f.FileName"') do set jsonFile=%%i

:: Check if a file was selected
if "%jsonFile%"=="" (
    echo No file selected. Exiting.
    pause
    exit /b
)

:: Inform the user which file was selected
echo You selected: %jsonFile%

:: Run the Python script with the selected JSON file
python json-2-csharp-model.py "%jsonFile%"

:: Check if the csharp-model folder exists
if exist "csharp-model" (
    echo Opening the csharp-model folder...
    start "" "csharp-model"
) else (
    echo Error: csharp-model folder was not created.
)

:: Wait for the user to press a key before closing
pause
