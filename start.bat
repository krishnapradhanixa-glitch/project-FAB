@echo off
REM ══════════════════════════════════════════════════════
REM  PROJECT FAB — Build and Start Script (Windows)
REM ══════════════════════════════════════════════════════
setlocal

set JAVA_HOME=C:\Program Files\Java\jdk-26.0.1
set JAVAC=%JAVA_HOME%\bin\javac.exe
set JAVA=%JAVA_HOME%\bin\java.exe
set MARIA_BASE=D:\project-fab\lib\mariadb-extracted\mariadb-10.11.10-winx64
set MARIA_DATA=D:\project-fab\lib\mariadb-data
set MARIA_CFG=D:\project-fab\lib\my.ini
set MYSQL=%MARIA_BASE%\bin\mysql.exe
set MYSQLD=%MARIA_BASE%\bin\mysqld.exe
set LIB=D:\project-fab\lib\mariadb-java-client.jar
set SRC_DIR=D:\project-fab\src
set BUILD_DIR=D:\project-fab\build\classes
set PROJECT_DIR=D:\project-fab

echo.
echo [1/4] Starting MariaDB database server...
netstat -ano | findstr ":3306" >nul 2>&1
if %errorlevel%==0 (
    echo       MariaDB already running on port 3306.
) else (
    start /B "" "%MYSQLD%" "--defaults-file=%MARIA_CFG%" "--datadir=%MARIA_DATA%" --console
    timeout /t 5 /nobreak >nul
    echo       MariaDB started.
)

echo.
echo [2/4] Compiling Java source files...
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
dir /s /b "%SRC_DIR%\*.java" > "%TEMP%\fab_sources.txt"
"%JAVAC%" -cp "%LIB%" -d "%BUILD_DIR%" @"%TEMP%\fab_sources.txt"
if %errorlevel% neq 0 (
    echo ERROR: Java compilation failed!
    pause
    exit /b 1
)
echo       Compilation successful.

echo.
echo [3/4] Copying configuration...
copy /Y "%PROJECT_DIR%\config.properties" "%BUILD_DIR%\..\..\..\config.properties" >nul 2>&1
copy /Y "%PROJECT_DIR%\config.properties" "%PROJECT_DIR%\config.properties" >nul 2>&1

echo.
echo [4/4] Starting Project FAB server...
echo       Open http://localhost:8080 in your browser.
echo       Press Ctrl+C to stop.
echo.
cd /d "%PROJECT_DIR%"
"%JAVA%" -cp "%BUILD_DIR%;%LIB%" com.fab.server.MainServer

pause
