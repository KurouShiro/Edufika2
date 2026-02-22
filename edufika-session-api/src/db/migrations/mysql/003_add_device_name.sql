ALTER TABLE device_bindings
  ADD COLUMN IF NOT EXISTS device_name VARCHAR(128) NULL AFTER ip_address;
