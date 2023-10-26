export class RealmConfig {
  clientScopes: ClientScope[];
  authenticationFlows: AuthenticationFlow[];
  authenticatorConfig: AuthenticationConfig[];
}

class ClientScope {
  name: string;
}

class AuthenticationFlow {
  alias: string;
}

class AuthenticationConfig {
  alias: string;
}
