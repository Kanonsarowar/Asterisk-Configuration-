# IPRN range inventory API (Phase 1)

Routes are implemented in `dashboard/server.js` (Node HTTP server, not a separate Fastify process) to share session auth with the existing dashboard.

- `GET /api/iprn-inventory/ranges` — list range rows (`iprn_inv_numbers` + supplier name)
- `POST /api/iprn-inventory/ranges` — create range (+ default pricing/stats rows)
- `PUT /api/iprn-inventory/ranges/:id/status` — lifecycle status
- `GET|POST /api/iprn-inventory/suppliers` — IPRN-module suppliers (`iprn_inv_suppliers`)

Schema: `/sql/iprn_inventory.sql` (loaded on MySQL init via `dashboard/lib/mysql.js`).

Optional Fastify mirror: use the same SQL and wire `fastify.db` to mysql2; do not duplicate table names with existing `numbers` in `iprn_system`.
