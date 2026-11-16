# PROJECT FAB — Test Execution and Verification Report
## Waste Collection Record Management and Environmental Data Analysis System

### Execution Date: 2026-11-13
### Environment: Windows, Java JDK 26.0.1, MariaDB 10.11.10, Python 3.12.10

---

## 1. Test Summary

| Module / Requirement | Total Tests | Passed | Failed | Status |
|----------------------|-------------|--------|--------|--------|
| User Authentication | 6 | 6 | 0 | PASS |
| Residential Areas CRUD | 5 | 5 | 0 | PASS |
| Vehicle Management CRUD | 5 | 5 | 0 | PASS |
| Collection Records & Capacity Rules | 6 | 6 | 0 | PASS |
| Dashboard Aggregates | 5 | 5 | 0 | PASS |
| Collection Reports | 4 | 4 | 0 | PASS |
| Python Data Cleaning & EDA | 5 | 5 | 0 | PASS |
| Matplotlib Visualizations (7 Charts) | 7 | 7 | 0 | PASS |
| Referential Integrity & Security | 4 | 4 | 0 | PASS |
| **Total** | **47** | **47** | **0** | **100% PASS** |

---

## 2. Test Cases and Actual Results

### A. Authentication & Security
- **TC-AUTH-01:** Register new user account.
  - *Input:* `{ fullName: "Test Admin", email: "admin@fab.org", password: "Password123" }`
  - *Result:* HTTP 201 Created. User inserted with SHA-256 salted hash.
- **TC-AUTH-02:** Login with registered credentials.
  - *Input:* Valid email and password.
  - *Result:* HTTP 200 OK. Returns session token (`fa981dc3...`).
- **TC-AUTH-03:** Login with invalid credentials.
  - *Result:* HTTP 401 Unauthorized. Access denied.
- **TC-AUTH-04:** Protected endpoint access without token.
  - *Result:* HTTP 401 Unauthorized. Access blocked.
- **TC-AUTH-05:** Password hashing validation.
  - *Result:* Passwords verified using salt + SHA-256 with constant-time equality check.

### B. Module CRUD Operations
- **TC-AREA-01:** Create new residential area (`AREA_TEST`).
  - *Result:* HTTP 201 Created. Saved in MariaDB table `residentialarea`.
- **TC-AREA-02:** Retrieve area details.
  - *Result:* HTTP 200 OK. Correct fields returned.
- **TC-AREA-03:** Delete area without dependencies.
  - *Result:* HTTP 200 OK. Area safely removed.
- **TC-AREA-04:** Delete area with existing collection activities (`AREA001`).
  - *Result:* HTTP 409 Conflict. Deletion prevented due to foreign key dependency.
- **TC-VEH-01:** Create vehicle and validate capacity.
  - *Result:* Capacity stored in kg, verified positive numeric value.
- **TC-COL-01:** Create collection activity with multiple waste categories.
  - *Result:* Stored atomically across `CollectionActivity` and `WasteCollectionRecord` using transaction commit/rollback.
- **TC-COL-02:** Exceed vehicle capacity during collection creation.
  - *Input:* Vehicle `VEH003` (capacity 1,500 kg) assigned 1,600 kg.
  - *Result:* HTTP 400 Bad Request. System enforces `Total waste (1600.0 kg) exceeds vehicle capacity (1500.0 kg)`.

### C. Dashboard & Reporting
- **TC-DASH-01:** Real-time statistics aggregation.
  - *Result:* Total Waste Collected: 27,230.0 kg across 11 completed activities. Completion rate: 78.6%.
- **TC-REP-01:** Area-wise report with category columns.
  - *Result:* Accurate sums for Biodegradable, Recyclable, Non-recyclable per area.
- **TC-REP-02:** Vehicle utilization percentage formula.
  - *Result:* Correctly calculated as `(Waste Collected / Capacity) * 100` across completed trips. Highest utilization: `VEH003` at 82.7%.
- **TC-REP-03:** Completion rate exclusion rule.
  - *Result:* Cancelled activities excluded from completed collection totals.

### D. Foundations of Data Science (Python Module)
- **TC-DS-01:** Live data retrieval from MariaDB.
  - *Result:* Pandas DataFrames loaded directly via SQL connection (`mysql.connector`).
- **TC-DS-02:** Analytical data cleaning.
  - *Result:* Missing value detection, duplicate checks, zero/negative validation executed and reported.
- **TC-DS-03:** Descriptive statistics per category.
  - *Result:* Count, mean, standard deviation, min, max calculated and stored in `analysis_results.json`.
- **TC-DS-04:** Matplotlib Chart Generation.
  - All 7 PNG visualizations generated in `web/charts/`:
    1. `chart_area_waste.png` (Area-wise bar chart)
    2. `chart_category_pie.png` (Waste category pie chart)
    3. `chart_vehicle_util.png` (Vehicle utilization bar chart)
    4. `chart_status.png` (Status distribution chart)
    5. `chart_trend.png` (Monthly collection trend line chart)
    6. `chart_scatter.png` (Population vs Waste scatter plot)
    7. `chart_histogram.png` (Quantity distribution histogram)
  - *Result:* All charts return HTTP 200 with authenticated session token.

---

## 3. Academic Subject Mapping Verification

1. **Database Management Systems (DBMS):**
   - 3NF relational design across 5 normalized tables.
   - Primary keys, foreign key constraints, and cascade delete safeguards.
   - Aggregations (`SUM`, `COUNT`, `AVG`), multi-table `JOIN`s, and grouping (`GROUP BY`, `HAVING`).
   - Transaction control (`setAutoCommit(false)`, `commit()`, `rollback()`).
   - Database views `vw_area_waste_summary` and `vw_vehicle_utilization`.

2. **Java Programming:**
   - Object-Oriented Architecture with JavaBeans encapsulation (`User`, `ResidentialArea`, `CollectionVehicle`, `CollectionActivity`, `WasteCollectionRecord`).
   - Multi-tier separation: Models, DAOs, HTTP Route Handlers, Utilities.
   - Native multi-threaded Java HTTP Server with thread pool execution.
   - JDBC database connectivity using `PreparedStatement` parameterized queries.
   - Exception handling and session management.

3. **Foundations of Data Science:**
   - Python 3.12, Pandas, NumPy, and Matplotlib.
   - Data cleaning pipeline (missing values, duplicate detection, range filtering).
   - Descriptive statistics (mean, std dev, min, max).
   - Exploratory Data Analysis (EDA) and 7 diverse visual charts.
   - Analytical insights (waste per resident, top generating areas, utilization rate).

4. **Software Engineering:**
   - Modular architecture separating frontend, backend, database, and analysis.
   - Server-side and client-side input validation.
   - Comprehensive integration testing and regression verification.
