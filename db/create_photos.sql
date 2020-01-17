create table photos (
  identifier varchar primary key,
  date varchar,
  borough varchar,
  block smallint,
  lot smallint,
  bldg_number_start varchar,
  bldg_number_end varchar,
  side_of_street boolean,
  street_name varchar,
  address varchar,
  condition varchar,
  coordinates point
);