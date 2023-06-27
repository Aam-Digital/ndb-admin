# Aam Digital admin utilities
A collection of simple operations to support server administration tasks of (multiple) hosted Aam Digital instances.
(e.g. bulk search & replace in config files, statistics of entities across instances, ...)

## Usage
This is not yet secured with authentication and should only be run locally.

1. Clone this repository 
    > git clone https://github.com/Aam-Digital/ndb-admin.git ndb-admin
2. Install dependencies
    > cd ndb-admin && npm install
3. Start
    > npm start
4. Visit `localhost:3000/api` in the browser

### Statistics
Get statistics of how many children and users are registered.

1. Copy the `collect_credentials.sh` script to the server and run it from the parent folder container your hosted Aam Digital instances
2. Copy the results to `credentials.json`
3. In `.env` assign the `KEYCLOAK_ADMIN_PASSWORD`
4. Execute the `/statistics` endpoint in the Swagger UI

### Bulk update
Update all docs that match a query with the provided object.
See `bulk-update.dto.ts`

### Update configs
Search and replace in all configs.

1. Provide the credentials as described in "Statistics"
2. Execute the `/edit-configs` endpoint with the required search and replace string
