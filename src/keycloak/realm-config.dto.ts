/**
 * The realm config as described here {@link https://www.keycloak.org/docs-api/22.0.5/rest-api/index.html#RealmRepresentation}
 * It can be retrieved using the realm export functionality.
 */
export class RealmConfig {
  realm: string;
  clientScopes: ClientScope[];
}

class ClientScope {
  name: string;
}
