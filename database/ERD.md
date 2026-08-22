# Database Architecture (ERD)

## Entities

### `profiles`
- `id` (PK, String) - Firebase UID
- `email` (String, Unique)
- `name` (String)
- `role` (String) - Admin, Faculty, Student
- `created_at` (Timestamp)

### `components`
- `id` (PK, Integer, Auto-increment)
- `name` (String)
- `category` (String)
- `stock` (Integer)
- `unit` (String)

### `requests`
- `id` (PK, Integer, Auto-increment)
- `user_id` (FK to profiles.id)
- `component_id` (FK to components.id)
- `quantity` (Integer)
- `status` (String) - Pending, Approved, Rejected, Returned
- `timestamp` (Timestamp)

### `purchase_orders`
- `id` (PK, Integer)
- `vendor` (String)
- `total_amount` (Decimal)
- `status` (String)
- `date` (Timestamp)

## Relationships
- A `Profile` can have multiple `Requests` (1:N).
- A `Component` can be associated with multiple `Requests` (1:N).

> [!NOTE]
> Detailed schema queries can be found in `database/schema.sql` (generated via migrations).
