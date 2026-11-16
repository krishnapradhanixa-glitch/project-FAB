# PROJECT FAB
## Waste Collection Record Management and Environmental Data Analysis System

A comprehensive, fully functional, integrated academic web application demonstrating core concepts across four B.Tech IT subjects: **DBMS**, **Java Programming**, **Foundations of Data Science**, and **Software Engineering**.

---

## 1. System Architecture

```text
       Browser Frontend (HTML5, CSS3, JavaScript SPA)
                           │  ▲
              HTTP / JSON  │  │  Responses & Charts
                           ▼  │
          Java Backend Server (HttpServer on port 8080)
           ├── AuthHandler & SessionManager
           ├── AreaHandler & AreaDAO
           ├── VehicleHandler & VehicleDAO
           ├── CollectionHandler & CollectionDAO
           ├── ReportHandler & ReportDAO
           ├── AnalysisHandler (ProcessBuilder)
           └── StaticHandler & ChartHandler
                           │  ▲
                     JDBC  │  │  SQL Queries & Transactions
                           ▼  │
           MariaDB / MySQL Relational Database (Port 3306)
           ├── Users (SHA-256 with Salt)
           ├── ResidentialArea
           ├── CollectionVehicle
           ├── CollectionActivity
           ├── WasteCollectionRecord
           └── Views (vw_area_waste_summary, vw_vehicle_utilization)
                           │  ▲
              Live Queries │  │  DataFrames
                           ▼  │
       Python Data Analysis Engine (analyze.py)
           ├── Pandas & NumPy (Data cleaning, aggregation, descriptive stats)
           └── Matplotlib (7 generated charts saved to web/charts/)
```

---

## 2. Prerequisites & Installed Environment

- **Operating System:** Windows 10/11
- **Java:** JDK 21+ (Tested on Oracle JDK 26.0.1)
- **Database:** MariaDB 10.11 / MySQL 8.0+ (Portable server included in `lib/mariadb-extracted`)
- **Python:** Python 3.12+ with `pandas`, `numpy`, `matplotlib`, and `mysql-connector-python`

---

## 3. Quick Start & Execution

### Option A: One-Click Launch (Windows Batch Script)
Double-click `D:\project-fab\start.bat` or run from PowerShell/CMD:
```cmd
cd D:\project-fab
start.bat
```
This script automatically:
1. Starts MariaDB on port 3306 if not already active.
2. Compiles all Java files to `build/classes/`.
3. Launches the Java `MainServer` on `http://localhost:8080`.

### Option B: Manual Launch
1. **Start MariaDB:**
   ```powershell
   & "D:\project-fab\lib\mariadb-extracted\mariadb-10.11.10-winx64\bin\mysqld.exe" --defaults-file="D:\project-fab\lib\my.ini" --console
   ```
2. **Compile Java Backend:**
   ```powershell
   javac -cp "D:\project-fab\lib\mariadb-java-client.jar" -d "D:\project-fab\build\classes" (Get-ChildItem -Path "D:\project-fab\src" -Recurse -Filter "*.java" | ForEach-Object { $_.FullName })
   ```
3. **Start Java Server:**
   ```powershell
   cd D:\project-fab
   java -cp "build/classes;lib/mariadb-java-client.jar" com.fab.server.MainServer
   ```
4. **Open in Browser:**
   Navigate to [http://localhost:8080](http://localhost:8080).

---

## 4. Default Credentials & Sample Data

- **Pre-registered Admin Account:**
  - **Email:** `admin@fab.org`
  - **Password:** `Password123`
- *New users can also register freely on the Registration page with password validation enforced.*
- **Pre-loaded Demonstration Data:**
  - 5 Residential Areas (`AREA001` to `AREA005`)
  - 5 Collection Vehicles (`VEH001` to `VEH005`)
  - 15 Collection Activities across multiple dates and statuses
  - 34 Itemized Waste Records across Biodegradable, Recyclable, and Non-recyclable categories

---

## 5. Application Modules

1. **Dashboard:** Real-time summary cards, total waste metric, completion rate progress bar, highest/lowest waste generating areas, and category breakdown.
2. **Residential Area Management:** Search, add, update, and delete areas with dependent collection deletion constraints.
3. **Vehicle Management:** Register and maintain collection vehicles with capacity in kg.
4. **Waste Collection Records:** Record activities referencing areas and vehicles, itemize category quantities, monitor status, and enforce strict vehicle capacity checks.
5. **Collection Reports:** Tabbed reporting for:
   - Area-wise waste with category columns.
   - Vehicle utilization (%) across completed trips.
   - Collection completion status and completion rates.
   - Date-wise waste collected (daily, weekly, monthly).
6. **Environmental Data Analysis:** One-click Python analysis generating missing/duplicate data cleaning audits, descriptive statistics (mean, std dev, min, max), analytical insights (waste per resident, top categories), and 7 rendered Matplotlib charts.

---

## 6. Project Directory Structure

```text
D:\project-fab\
├── config.properties          # Server port, database URL, credentials
├── start.bat                  # Automated launch script
├── README.md                  # Project documentation
├── database\
│   └── schema.sql             # MySQL/MariaDB DDL and sample data
├── docs\
│   └── TEST_REPORT.md         # Comprehensive test report (47/47 passed)
├── lib\
│   ├── mariadb-java-client.jar # JDBC Driver
│   ├── my.ini                 # MariaDB configuration
│   └── mariadb-data\          # Database data files
├── python\
│   ├── analyze.py             # Foundations of Data Science analysis script
│   └── analysis_results.json  # Output statistics and metrics
├── src\com\fab\
│   ├── model\                 # JavaBeans (User, Area, Vehicle, Activity, Waste)
│   ├── dao\                   # JDBC DAOs (UserDAO, AreaDAO, VehicleDAO, CollectionDAO, ReportDAO)
│   ├── server\                # Handlers (MainServer, AuthHandler, AreaHandler, etc.)
│   └── util\                  # DBUtil, PasswordUtil, SessionManager, HttpUtil
└── web\
    ├── index.html             # Responsive Single-Page Application
    ├── css\style.css          # Environmental design theme
    ├── js\api.js              # REST client wrapper
    ├── js\app.js              # Frontend UI logic and validation
    └── charts\                # 7 generated Matplotlib PNG visualizations
```
