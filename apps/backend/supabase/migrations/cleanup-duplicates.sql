-- Clean up duplicate entries caused by migrations running twice
-- Keeps the oldest entry (by created_at) for each duplicate group

DELETE FROM tour_packages
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (name, category) id
    FROM tour_packages
    ORDER BY name, category, created_at ASC
  ) AS keep
);

DELETE FROM products
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (name) id
    FROM products
    ORDER BY name, created_at ASC
  ) AS keep
);

DELETE FROM inventory_rentals
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (name) id
    FROM inventory_rentals
    ORDER BY name, created_at ASC
  ) AS keep
);
