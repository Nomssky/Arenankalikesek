-- Clean up duplicate entries caused by migrations running twice
-- Keeps the oldest entry for each duplicate group

DELETE FROM tour_packages
WHERE id NOT IN (
  SELECT MIN(id)
  FROM tour_packages
  GROUP BY name, category
);

DELETE FROM products
WHERE id NOT IN (
  SELECT MIN(id)
  FROM products
  GROUP BY name
);

DELETE FROM inventory_rentals
WHERE id NOT IN (
  SELECT MIN(id)
  FROM inventory_rentals
  GROUP BY name
);
