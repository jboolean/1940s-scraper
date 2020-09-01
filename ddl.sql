-- public.photos definition

-- Drop table

-- DROP TABLE public.photos;

CREATE TABLE public.photos (
	identifier varchar NOT NULL,
	"date" varchar NULL,
	borough varchar NULL,
	block int2 NULL,
	lot numeric(7,2) NULL,
	bldg_number_start varchar NULL,
	bldg_number_end varchar NULL,
	side_of_street bool NULL,
	street_name varchar NULL,
	address varchar NULL,
	"condition" varchar NULL,
	coordinates point NULL,
	is_outtake bool NOT NULL DEFAULT false,
	deleted bool NOT NULL DEFAULT false,
	CONSTRAINT photos_pkey PRIMARY KEY (identifier)
);
CREATE INDEX photos_is_outtake_idx ON public.photos USING btree (is_outtake);


-- public.geocode_results definition

-- Drop table

-- DROP TABLE public.geocode_results;

CREATE TABLE public.geocode_results (
	"method" varchar NOT NULL,
	lng_lat point NULL,
	photo varchar NULL,
	CONSTRAINT geocode_result_photo_fkey FOREIGN KEY (photo) REFERENCES photos(identifier)
);
CREATE INDEX geocode_results_bool_idx ON public.geocode_results USING btree ((true)) WHERE (lng_lat IS NULL);
CREATE INDEX geocode_results_bool_idx1 ON public.geocode_results USING btree ((true)) WHERE (lng_lat IS NOT NULL);
CREATE INDEX geocode_results_lng_lat_idx ON public.geocode_results USING gist (lng_lat);
CREATE INDEX geocode_results_lng_lat_idx1 ON public.geocode_results USING gist (lng_lat);
CREATE INDEX geocode_results_method_idx ON public.geocode_results USING btree (method);
CREATE UNIQUE INDEX geocode_results_photo__method_idx ON public.geocode_results USING btree (photo, method);
CREATE INDEX geocode_results_photo_idx ON public.geocode_results USING btree (photo) WHERE (lng_lat IS NOT NULL);

-- public.photos_with_effective_geocode_view source

CREATE OR REPLACE VIEW public.photos_with_effective_geocode_view
AS SELECT DISTINCT ON (photos.identifier) photos.identifier,
    photos.date,
    photos.borough,
    photos.block,
    photos.lot,
    photos.bldg_number_start,
    photos.bldg_number_end,
    photos.side_of_street,
    photos.street_name,
    photos.address,
    photos.condition,
    geocode_results.lng_lat,
    geocode_results.method
   FROM photos
     JOIN geocode_results ON photos.identifier::text = geocode_results.photo::text
     JOIN ( VALUES ('pluto'::text,1), ('geosearch'::text,2), ('gmaps'::text,3), ('gmapsPlacesAutocomplete'::text,4), ('mapbox'::text,999)) method_order(method, rank) ON geocode_results.method::text = method_order.method
  WHERE NOT photos.deleted AND geocode_results.lng_lat IS NOT NULL AND geocode_results.method::text <> 'mapbox'::text
  ORDER BY photos.identifier, method_order.rank;


-- public.effective_geocodes_view source

CREATE MATERIALIZED VIEW public.effective_geocodes_view
TABLESPACE pg_default
AS SELECT DISTINCT ON (photos.identifier) photos.identifier,
    geocode_results.lng_lat,
    geocode_results.method
   FROM photos
     JOIN geocode_results ON photos.identifier::text = geocode_results.photo::text
     JOIN ( VALUES ('pluto'::text,1), ('geosearch'::text,2), ('gmaps'::text,3), ('gmapsPlacesAutocomplete'::text,4), ('mapbox'::text,999)) method_order(method, rank) ON geocode_results.method::text = method_order.method
  WHERE NOT photos.deleted AND geocode_results.lng_lat IS NOT NULL AND geocode_results.method::text <> 'mapbox'::text
  ORDER BY photos.identifier, method_order.rank
WITH DATA;