TYPE=VIEW
query=select `cv`.`VehicleID` AS `VehicleID`,`cv`.`VehicleType` AS `VehicleType`,`cv`.`Capacity` AS `Capacity`,count(distinct case when `ca`.`Status` = \'Completed\' then `ca`.`CollectionID` end) AS `CompletedTrips`,coalesce(avg(case when `ca`.`Status` = \'Completed\' then (select sum(`wcr2`.`Quantity`) from `projectfab`.`wastecollectionrecord` `wcr2` where `wcr2`.`CollectionID` = `ca`.`CollectionID`) / `cv`.`Capacity` * 100 end),0) AS `AvgUtilizationPct`,coalesce(sum(case when `ca`.`Status` = \'Completed\' then (select sum(`wcr2`.`Quantity`) from `projectfab`.`wastecollectionrecord` `wcr2` where `wcr2`.`CollectionID` = `ca`.`CollectionID`) end),0) AS `TotalWasteCollected` from (`projectfab`.`collectionvehicle` `cv` left join `projectfab`.`collectionactivity` `ca` on(`cv`.`VehicleID` = `ca`.`VehicleID`)) group by `cv`.`VehicleID`,`cv`.`VehicleType`,`cv`.`Capacity`
md5=2366f951c20fa89e0220df1b32d23460
updatable=0
algorithm=0
definer_user=root
definer_host=localhost
suid=2
with_check_option=0
timestamp=0001794327117483490
create-version=2
source=SELECT\n    cv.VehicleID,\n    cv.VehicleType,\n    cv.Capacity,\n    COUNT(DISTINCT CASE WHEN ca.Status = \'Completed\' THEN ca.CollectionID END) AS CompletedTrips,\n    COALESCE(AVG(CASE WHEN ca.Status = \'Completed\'\n        THEN (SELECT SUM(wcr2.Quantity) FROM WasteCollectionRecord wcr2 WHERE wcr2.CollectionID = ca.CollectionID) / cv.Capacity * 100\n    END), 0) AS AvgUtilizationPct,\n    COALESCE(SUM(CASE WHEN ca.Status = \'Completed\' THEN\n        (SELECT SUM(wcr2.Quantity) FROM WasteCollectionRecord wcr2 WHERE wcr2.CollectionID = ca.CollectionID)\n    END), 0) AS TotalWasteCollected\nFROM CollectionVehicle cv\nLEFT JOIN CollectionActivity ca ON cv.VehicleID = ca.VehicleID\nGROUP BY cv.VehicleID, cv.VehicleType, cv.Capacity
client_cs_name=utf8mb4
connection_cl_name=utf8mb4_general_ci
view_body_utf8=select `cv`.`VehicleID` AS `VehicleID`,`cv`.`VehicleType` AS `VehicleType`,`cv`.`Capacity` AS `Capacity`,count(distinct case when `ca`.`Status` = \'Completed\' then `ca`.`CollectionID` end) AS `CompletedTrips`,coalesce(avg(case when `ca`.`Status` = \'Completed\' then (select sum(`wcr2`.`Quantity`) from `projectfab`.`wastecollectionrecord` `wcr2` where `wcr2`.`CollectionID` = `ca`.`CollectionID`) / `cv`.`Capacity` * 100 end),0) AS `AvgUtilizationPct`,coalesce(sum(case when `ca`.`Status` = \'Completed\' then (select sum(`wcr2`.`Quantity`) from `projectfab`.`wastecollectionrecord` `wcr2` where `wcr2`.`CollectionID` = `ca`.`CollectionID`) end),0) AS `TotalWasteCollected` from (`projectfab`.`collectionvehicle` `cv` left join `projectfab`.`collectionactivity` `ca` on(`cv`.`VehicleID` = `ca`.`VehicleID`)) group by `cv`.`VehicleID`,`cv`.`VehicleType`,`cv`.`Capacity`
mariadb-version=101110
