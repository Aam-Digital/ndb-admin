# Aam Digital admin utilities
A collection of simple operations to support server administration tasks of (multiple) hosted Aam Digital instances.
(e.g. bulk search & replace in config files, statistics of entities across instances, ...)

## Usage
This is not secured with authentication and should be deployed with other security measures in place.

Have a look at the instructions in the [ndb-setup repo](https://github.com/Aam-Digital/ndb-setup/blob/master/admin/README.md) for deployment and usage through an SSH tunnel.
Alternatively, the master build can be pulled from [docker hub](https://hub.docker.com/repository/docker/aamdigital/ndb-admin/general).

Once deployed visit `localhost:3000/api` to see the available endpoints and their description.

The endpoints which work across multiple instances iterate over all organisations listed in `credentials.json`.
Further adjustments might have to be done in the `.env` file.
