"""
PROJECT FAB — Environmental Data Analysis Module
Demonstrates: Python, Pandas, NumPy, Matplotlib (Foundations of Data Science)
Retrieves actual records from MariaDB/MySQL and performs analysis.
"""

import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

# ── Dependencies check ──────────────────────────────────────────────────────
try:
    import pandas as pd
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend for server use
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import mysql.connector
except ImportError as e:
    print(json.dumps({"error": f"Missing Python package: {e}. Run: pip install pandas numpy matplotlib mysql-connector-python"}))
    sys.exit(1)

# ── Database Configuration ───────────────────────────────────────────────────
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "root",
    "database": "projectfab"
}

CHARTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "charts")
OUTPUT_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analysis_results.json")

os.makedirs(CHARTS_DIR, exist_ok=True)

# ── Chart style ──────────────────────────────────────────────────────────────
COLORS = ["#2ecc71", "#3498db", "#e74c3c", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22"]
plt.rcParams.update({
    "figure.facecolor": "#ffffff",
    "axes.facecolor": "#f8f9fa",
    "axes.grid": True,
    "grid.alpha": 0.3,
    "font.size": 10,
})

def save_chart(fig, name):
    path = os.path.join(CHARTS_DIR, name)
    fig.savefig(path, dpi=100, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return name

# ── Data Retrieval ────────────────────────────────────────────────────────────
def load_data():
    conn = mysql.connector.connect(**DB_CONFIG)

    df_areas = pd.read_sql(
        "SELECT AreaID, AreaName, Location, Population FROM ResidentialArea", conn)
    df_vehicles = pd.read_sql(
        "SELECT VehicleID, VehicleType, Capacity FROM CollectionVehicle", conn)
    df_activities = pd.read_sql(
        "SELECT CollectionID, AreaID, VehicleID, CollectionDate, Status FROM CollectionActivity", conn)
    df_waste = pd.read_sql(
        "SELECT RecordID, CollectionID, WasteCategory, Quantity FROM WasteCollectionRecord", conn)

    conn.close()
    return df_areas, df_vehicles, df_activities, df_waste

# ── Data Cleaning ─────────────────────────────────────────────────────────────
def clean_data(df_areas, df_vehicles, df_activities, df_waste):
    report = {}

    # Missing values
    report["missing_areas"]      = int(df_areas.isnull().sum().sum())
    report["missing_vehicles"]   = int(df_vehicles.isnull().sum().sum())
    report["missing_activities"] = int(df_activities.isnull().sum().sum())
    report["missing_waste"]      = int(df_waste.isnull().sum().sum())

    # Duplicates
    report["duplicate_activities"] = int(df_activities.duplicated(subset=["CollectionID"]).sum())
    report["duplicate_waste"]      = int(df_waste.duplicated(subset=["CollectionID","WasteCategory"]).sum())

    # Invalid values
    report["invalid_population"] = int((df_areas["Population"] <= 0).sum())
    report["invalid_capacity"]   = int((df_vehicles["Capacity"] <= 0).sum())
    report["invalid_quantity"]   = int((df_waste["Quantity"] <= 0).sum())

    # Drop null quantities (analytical only — no original records modified)
    df_waste_clean = df_waste.dropna(subset=["Quantity"])
    df_waste_clean = df_waste_clean[df_waste_clean["Quantity"] > 0]

    return df_waste_clean, report

# ── Descriptive Statistics ────────────────────────────────────────────────────
def descriptive_stats(df_waste_clean, df_activities):
    completed = df_activities[df_activities["Status"] == "Completed"]["CollectionID"]
    completed_waste = df_waste_clean[df_waste_clean["CollectionID"].isin(completed)]

    if completed_waste.empty:
        return {"note": "No completed collection data available for statistics"}

    desc = completed_waste.groupby("WasteCategory")["Quantity"].describe()
    stats = {}
    for cat in desc.index:
        row = desc.loc[cat]
        stats[cat] = {
            "count": int(row["count"]),
            "mean":  round(float(row["mean"]), 2),
            "std":   round(float(row["std"]) if not np.isnan(row["std"]) else 0, 2),
            "min":   round(float(row["min"]), 2),
            "max":   round(float(row["max"]), 2),
        }

    total = float(completed_waste["Quantity"].sum())
    stats["overall"] = {
        "total_waste_kg": round(total, 2),
        "mean_per_collection": round(float(completed_waste.groupby("CollectionID")["Quantity"].sum().mean()), 2),
        "total_collections": int(completed_waste["CollectionID"].nunique()),
    }
    return stats

# ── CHART 1: Area-wise Waste Collection Bar Chart ────────────────────────────
def chart_area_waste(df_areas, df_activities, df_waste_clean):
    completed_ids = df_activities[df_activities["Status"]=="Completed"]["CollectionID"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed_ids)]
    merged = cw.merge(df_activities[["CollectionID","AreaID"]], on="CollectionID")
    merged = merged.merge(df_areas[["AreaID","AreaName"]], on="AreaID")
    area_totals = merged.groupby("AreaName")["Quantity"].sum().sort_values(ascending=False)

    if area_totals.empty:
        return None, {"note": "No completed data for area chart"}

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(area_totals.index, area_totals.values,
                  color=COLORS[:len(area_totals)], edgecolor="white", linewidth=0.8)
    ax.set_title("Area-wise Recorded Waste Collected (Completed Activities)", fontweight="bold", pad=15)
    ax.set_xlabel("Residential Area")
    ax.set_ylabel("Total Recorded Waste Collected (kg)")
    for bar, val in zip(bars, area_totals.values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 20,
                f"{val:,.0f} kg", ha="center", va="bottom", fontsize=9)
    plt.xticks(rotation=15, ha="right")
    plt.tight_layout()
    return save_chart(fig, "chart_area_waste.png"), dict(zip(area_totals.index, area_totals.round(2).astype(float)))

# ── CHART 2: Waste Category Distribution Pie Chart ───────────────────────────
def chart_category_distribution(df_activities, df_waste_clean):
    completed_ids = df_activities[df_activities["Status"]=="Completed"]["CollectionID"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed_ids)]
    cat_totals = cw.groupby("WasteCategory")["Quantity"].sum()

    if cat_totals.empty:
        return None, {"note": "No completed data for category chart"}

    fig, ax = plt.subplots(figsize=(7, 6))
    wedge_colors = ["#2ecc71", "#3498db", "#e74c3c"]
    wedges, texts, autotexts = ax.pie(
        cat_totals.values, labels=cat_totals.index,
        colors=wedge_colors[:len(cat_totals)],
        autopct="%1.1f%%", startangle=140,
        pctdistance=0.75, wedgeprops={"edgecolor":"white","linewidth":2})
    for t in autotexts: t.set_fontsize(11)
    ax.set_title("Waste Category Distribution (Completed Activities)", fontweight="bold", pad=15)
    plt.tight_layout()
    return save_chart(fig, "chart_category_pie.png"), dict(zip(cat_totals.index, cat_totals.round(2).astype(float)))

# ── CHART 3: Vehicle Utilization Bar Chart ───────────────────────────────────
def chart_vehicle_utilization(df_vehicles, df_activities, df_waste_clean):
    completed = df_activities[df_activities["Status"]=="Completed"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed["CollectionID"])]
    trip_totals = cw.groupby("CollectionID")["Quantity"].sum().reset_index()
    trip_totals = trip_totals.merge(completed[["CollectionID","VehicleID"]], on="CollectionID")
    trip_totals = trip_totals.merge(df_vehicles[["VehicleID","Capacity","VehicleType"]], on="VehicleID")
    trip_totals["UtilizationPct"] = trip_totals["Quantity"] / trip_totals["Capacity"] * 100
    veh_util = trip_totals.groupby(["VehicleID","VehicleType"])["UtilizationPct"].mean().reset_index()
    veh_util.columns = ["VehicleID","VehicleType","AvgUtil"]
    veh_util = veh_util.sort_values("AvgUtil", ascending=False)

    if veh_util.empty:
        return None, {"note": "No completed data for vehicle utilization chart"}

    labels = [f"{r.VehicleID}\n({r.VehicleType[:10]})" for _, r in veh_util.iterrows()]
    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(labels, veh_util["AvgUtil"].values,
                  color=COLORS[:len(veh_util)], edgecolor="white")
    ax.set_title("Average Vehicle Utilization % (Completed Trips)", fontweight="bold", pad=15)
    ax.set_xlabel("Vehicle")
    ax.set_ylabel("Average Utilization (%)")
    ax.set_ylim(0, min(110, veh_util["AvgUtil"].max() * 1.2))
    ax.axhline(y=100, color="red", linestyle="--", linewidth=1, label="Full Capacity (100%)")
    ax.legend()
    for bar, val in zip(bars, veh_util["AvgUtil"].values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    data = {r.VehicleID: round(float(r.AvgUtil), 2) for _, r in veh_util.iterrows()}
    return save_chart(fig, "chart_vehicle_util.png"), data

# ── CHART 4: Collection Status Distribution ──────────────────────────────────
def chart_status_distribution(df_activities):
    status_counts = df_activities["Status"].value_counts()
    if status_counts.empty:
        return None, {"note": "No activities data"}

    fig, ax = plt.subplots(figsize=(7, 5))
    status_colors = {"Completed":"#2ecc71","In Progress":"#f39c12","Scheduled":"#3498db","Cancelled":"#e74c3c"}
    colors = [status_colors.get(s, "#95a5a6") for s in status_counts.index]
    bars = ax.bar(status_counts.index, status_counts.values, color=colors, edgecolor="white")
    ax.set_title("Collection Activity Status Distribution", fontweight="bold", pad=15)
    ax.set_xlabel("Status")
    ax.set_ylabel("Number of Activities")
    for bar, val in zip(bars, status_counts.values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                str(val), ha="center", va="bottom", fontweight="bold")
    plt.tight_layout()
    return save_chart(fig, "chart_status.png"), status_counts.to_dict()

# ── CHART 5: Waste Collection Trend Line Chart ───────────────────────────────
def chart_waste_trend(df_activities, df_waste_clean):
    completed = df_activities[df_activities["Status"]=="Completed"].copy()
    completed["CollectionDate"] = pd.to_datetime(completed["CollectionDate"])
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed["CollectionID"])]
    merged = cw.merge(completed[["CollectionID","CollectionDate"]], on="CollectionID")
    merged["Month"] = merged["CollectionDate"].dt.to_period("M")
    monthly = merged.groupby("Month")["Quantity"].sum().reset_index()
    monthly["Month"] = monthly["Month"].astype(str)

    if monthly.empty or len(monthly) < 1:
        return None, {"note": "Insufficient data for trend chart"}

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(monthly["Month"], monthly["Quantity"], marker="o", linewidth=2.5,
            color="#3498db", markersize=6, markerfacecolor="white", markeredgewidth=2)
    ax.fill_between(range(len(monthly)), monthly["Quantity"], alpha=0.15, color="#3498db")
    ax.set_xticks(range(len(monthly)))
    ax.set_xticklabels(monthly["Month"], rotation=30, ha="right")
    ax.set_title("Monthly Recorded Waste Collection Trend (Completed Activities)", fontweight="bold", pad=15)
    ax.set_xlabel("Month")
    ax.set_ylabel("Total Recorded Waste Collected (kg)")
    plt.tight_layout()
    data = dict(zip(monthly["Month"], monthly["Quantity"].round(2).astype(float)))
    return save_chart(fig, "chart_trend.png"), data

# ── CHART 6: Population vs Waste Scatter ─────────────────────────────────────
def chart_population_vs_waste(df_areas, df_activities, df_waste_clean):
    completed_ids = df_activities[df_activities["Status"]=="Completed"]["CollectionID"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed_ids)]
    merged = cw.merge(df_activities[["CollectionID","AreaID"]], on="CollectionID")
    area_waste = merged.groupby("AreaID")["Quantity"].sum().reset_index()
    area_waste.columns = ["AreaID","TotalWaste"]
    area_data = df_areas.merge(area_waste, on="AreaID", how="left").fillna(0)

    if len(area_data) < 2:
        return None, {"note": "Insufficient area data for scatter plot"}

    fig, ax = plt.subplots(figsize=(8, 5))
    scatter = ax.scatter(area_data["Population"], area_data["TotalWaste"],
                         c=COLORS[:len(area_data)], s=120, edgecolors="white", linewidths=1.5, zorder=5)
    for _, row in area_data.iterrows():
        ax.annotate(row["AreaName"], (row["Population"], row["TotalWaste"]),
                    textcoords="offset points", xytext=(5, 5), fontsize=8)
    # Correlation
    if area_data["TotalWaste"].sum() > 0:
        corr = area_data["Population"].corr(area_data["TotalWaste"])
        ax.set_title(f"Population vs Recorded Waste Collected\n(Pearson r = {corr:.3f})", fontweight="bold")
    else:
        ax.set_title("Population vs Recorded Waste Collected", fontweight="bold")
    ax.set_xlabel("Population")
    ax.set_ylabel("Total Recorded Waste Collected (kg)")
    plt.tight_layout()
    corr_val = float(area_data["Population"].corr(area_data["TotalWaste"])) if area_data["TotalWaste"].sum() > 0 else 0.0
    return save_chart(fig, "chart_scatter.png"), {"correlation": round(corr_val, 4)}

# ── CHART 7: Waste Quantity Distribution Histogram ───────────────────────────
def chart_quantity_histogram(df_activities, df_waste_clean):
    completed_ids = df_activities[df_activities["Status"]=="Completed"]["CollectionID"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed_ids)]
    trip_totals = cw.groupby("CollectionID")["Quantity"].sum()

    if trip_totals.empty or len(trip_totals) < 2:
        return None, {"note": "Insufficient data for histogram"}

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(trip_totals.values, bins=min(10, len(trip_totals)),
            color="#3498db", edgecolor="white", linewidth=0.8, alpha=0.85)
    ax.axvline(trip_totals.mean(), color="#e74c3c", linestyle="--", linewidth=2, label=f"Mean: {trip_totals.mean():.0f} kg")
    ax.set_title("Distribution of Recorded Waste per Collection Trip (Completed)", fontweight="bold", pad=15)
    ax.set_xlabel("Recorded Waste Collected per Trip (kg)")
    ax.set_ylabel("Frequency")
    ax.legend()
    plt.tight_layout()
    data = {"mean": round(float(trip_totals.mean()), 2), "std": round(float(trip_totals.std()), 2),
            "min": round(float(trip_totals.min()), 2), "max": round(float(trip_totals.max()), 2)}
    return save_chart(fig, "chart_histogram.png"), data

# ── Analytical Insights ───────────────────────────────────────────────────────
def compute_insights(df_areas, df_vehicles, df_activities, df_waste_clean):
    insights = []
    completed_ids = df_activities[df_activities["Status"]=="Completed"]["CollectionID"]
    cw = df_waste_clean[df_waste_clean["CollectionID"].isin(completed_ids)]

    if cw.empty:
        insights.append("No completed collection activities found for analysis.")
        return insights

    # Highest/lowest waste area
    area_waste = cw.merge(df_activities[["CollectionID","AreaID"]], on="CollectionID")
    area_waste = area_waste.merge(df_areas[["AreaID","AreaName","Population"]], on="AreaID")
    area_totals = area_waste.groupby(["AreaName","Population"])["Quantity"].sum()
    if not area_totals.empty:
        max_area = area_totals.idxmax()
        min_area = area_totals.idxmin()
        insights.append(f"Highest recorded waste collection: {max_area[0]} ({area_totals[max_area]:,.0f} kg)")
        insights.append(f"Lowest recorded waste collection: {min_area[0]} ({area_totals[min_area]:,.0f} kg)")
        # Waste per resident
        for (name, pop), qty in area_totals.items():
            if pop > 0:
                per_res = qty / pop
                insights.append(f"Recorded waste per resident in {name}: {per_res:.4f} kg/person")

    # Top waste category
    cat_totals = cw.groupby("WasteCategory")["Quantity"].sum()
    if not cat_totals.empty:
        top_cat = cat_totals.idxmax()
        total = cat_totals.sum()
        pct = cat_totals[top_cat] / total * 100
        insights.append(f"Highest waste category: {top_cat} ({pct:.1f}% of total recorded waste)")

    # Vehicle utilization
    trip_totals = cw.groupby("CollectionID")["Quantity"].sum().reset_index()
    trip_totals = trip_totals.merge(df_activities[["CollectionID","VehicleID"]], on="CollectionID")
    trip_totals = trip_totals.merge(df_vehicles[["VehicleID","Capacity"]], on="VehicleID")
    trip_totals["Util"] = trip_totals["Quantity"] / trip_totals["Capacity"] * 100
    veh_avg = trip_totals.groupby("VehicleID")["Util"].mean()
    if not veh_avg.empty:
        top_veh = veh_avg.idxmax()
        insights.append(f"Highest vehicle utilization: {top_veh} ({veh_avg[top_veh]:.1f}% avg utilization)")

    # Completion rate
    total = len(df_activities)
    completed = int((df_activities["Status"]=="Completed").sum())
    non_cancelled = int((df_activities["Status"]!="Cancelled").sum())
    pct_complete = (completed / non_cancelled * 100) if non_cancelled > 0 else 0
    insights.append(f"Collection completion rate: {pct_complete:.1f}% ({completed}/{non_cancelled} non-cancelled activities)")

    return insights

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    try:
        # Load data
        df_areas, df_vehicles, df_activities, df_waste = load_data()

        # Clean
        df_waste_clean, cleaning_report = clean_data(df_areas, df_vehicles, df_activities, df_waste)

        # Stats
        stats = descriptive_stats(df_waste_clean, df_activities)

        # Charts
        charts = {}
        c1, d1 = chart_area_waste(df_areas, df_activities, df_waste_clean)
        charts["areaWaste"] = {"file": c1, "data": d1}

        c2, d2 = chart_category_distribution(df_activities, df_waste_clean)
        charts["categoryPie"] = {"file": c2, "data": d2}

        c3, d3 = chart_vehicle_utilization(df_vehicles, df_activities, df_waste_clean)
        charts["vehicleUtil"] = {"file": c3, "data": d3}

        c4, d4 = chart_status_distribution(df_activities)
        charts["statusDist"] = {"file": c4, "data": d4}

        c5, d5 = chart_waste_trend(df_activities, df_waste_clean)
        charts["trend"] = {"file": c5, "data": d5}

        c6, d6 = chart_population_vs_waste(df_areas, df_activities, df_waste_clean)
        charts["scatter"] = {"file": c6, "data": d6}

        c7, d7 = chart_quantity_histogram(df_activities, df_waste_clean)
        charts["histogram"] = {"file": c7, "data": d7}

        # Insights
        insights = compute_insights(df_areas, df_vehicles, df_activities, df_waste_clean)

        # Summary
        result = {
            "status": "success",
            "summary": {
                "totalAreas": int(len(df_areas)),
                "totalVehicles": int(len(df_vehicles)),
                "totalActivities": int(len(df_activities)),
                "totalRecords": int(len(df_waste)),
            },
            "cleaningReport": {k: int(v) if isinstance(v, (int, np.integer)) else v for k, v in cleaning_report.items()},
            "descriptiveStats": stats,
            "charts": charts,
            "insights": insights,
        }

        with open(OUTPUT_JSON, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(json.dumps({"status": "success", "message": "Analysis complete", "charts": list(charts.keys())}))

    except Exception as e:
        import traceback
        err = {"status": "error", "error": str(e), "traceback": traceback.format_exc()}
        print(json.dumps(err))
        with open(OUTPUT_JSON, "w") as f:
            json.dump(err, f)
        sys.exit(1)

if __name__ == "__main__":
    main()
