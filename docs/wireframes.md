# Application Views

The implemented application includes these connected views:

1. **Login**: staff/admin sign-in entry point with role-aware copy.
2. **Dashboard**: stock health, today's sales, low-stock alert, and recent activity.
3. **Inventory**: product lookup, stock status, and movement entry point.
4. **POS**: product search, cart, payment method, checkout, receipt, and automatic stock deduction.
5. **Stock operations**: stock-in receiving and stock-out adjustment forms with movement history.
6. **Sales and reports**: transaction history, transaction details, date filters, report filters, and CSV export.
7. **Administration**: staff account management, role restrictions, profiles, and notifications.

Navigation is intentionally limited to approved scope: Dashboard, Products, Inventory, POS, Sales, Reports, and Users. Users is marked admin-only in the prototype. No e-commerce, payment gateway, accounting, repair, vehicle, or multi-branch surfaces are included.
