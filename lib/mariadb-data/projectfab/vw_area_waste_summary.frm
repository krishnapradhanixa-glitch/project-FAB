TYPE=VIEW
query=select `ra`.`AreaID` AS `AreaID`,`ra`.`AreaName` AS `AreaName`,`ra`.`Location` AS `Location`,`ra`.`Population` AS `Population`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Biodegradable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalBiodegradable`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Recyclable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalRecyclable`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Non-recyclable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalNonRecyclable`,coalesce(sum(`wcr`.`Quantity`),0) AS `TotalWaste` from ((`projectfab`.`residentialarea` `ra` left join `projectfab`.`collectionactivity` `ca` on(`ra`.`AreaID` = `ca`.`AreaID` and `ca`.`Status` <> \'Cancelled\')) left join `projectfab`.`wastecollectionrecord` `wcr` on(`ca`.`CollectionID` = `wcr`.`CollectionID`)) group by `ra`.`AreaID`,`ra`.`AreaName`,`ra`.`Location`,`ra`.`Population`
md5=cc750254284f7553f2dee6d79463499b
updatable=0
algorithm=0
definer_user=root
definer_host=localhost
suid=2
with_check_option=0
timestamp=0001794327117480132
create-version=2
source=SELECT\n    ra.AreaID,\n    ra.AreaName,\n    ra.Location,\n    ra.Population,\n    COALESCE(SUM(CASE WHEN wcr.WasteCategory = \'Biodegradable\'  THEN wcr.Quantity ELSE 0 END), 0) AS TotalBiodegradable,\n    COALESCE(SUM(CASE WHEN wcr.WasteCategory = \'Recyclable\'     THEN wcr.Quantity ELSE 0 END), 0) AS TotalRecyclable,\n    COALESCE(SUM(CASE WHEN wcr.WasteCategory = \'Non-recyclable\' THEN wcr.Quantity ELSE 0 END), 0) AS TotalNonRecyclable,\n    COALESCE(SUM(wcr.Quantity), 0) AS TotalWaste\nFROM ResidentialArea ra\nLEFT JOIN CollectionActivity ca ON ra.AreaID = ca.AreaID AND ca.Status != \'Cancelled\'\nLEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID = wcr.CollectionID\nGROUP BY ra.AreaID, ra.AreaName, ra.Location, ra.Population
client_cs_name=utf8mb4
connection_cl_name=utf8mb4_general_ci
view_body_utf8=select `ra`.`AreaID` AS `AreaID`,`ra`.`AreaName` AS `AreaName`,`ra`.`Location` AS `Location`,`ra`.`Population` AS `Population`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Biodegradable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalBiodegradable`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Recyclable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalRecyclable`,coalesce(sum(case when `wcr`.`WasteCategory` = \'Non-recyclable\' then `wcr`.`Quantity` else 0 end),0) AS `TotalNonRecyclable`,coalesce(sum(`wcr`.`Quantity`),0) AS `TotalWaste` from ((`projectfab`.`residentialarea` `ra` left join `projectfab`.`collectionactivity` `ca` on(`ra`.`AreaID` = `ca`.`AreaID` and `ca`.`Status` <> \'Cancelled\')) left join `projectfab`.`wastecollectionrecord` `wcr` on(`ca`.`CollectionID` = `wcr`.`CollectionID`)) group by `ra`.`AreaID`,`ra`.`AreaName`,`ra`.`Location`,`ra`.`Population`
mariadb-version=101110
