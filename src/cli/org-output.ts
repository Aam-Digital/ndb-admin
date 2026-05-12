import { ConnectivityResult, OrgRunner } from './org-runner';

/* Helper functions for printing output to CLI */

export function printConnectivity(results: ConnectivityResult[]): void {
  console.log(
    `\nConnectivity check (${results.length} org${results.length !== 1 ? 's' : ''})...`,
  );
  for (const { org, reachable } of results) {
    const mark = reachable ? '✓' : '✗';
    const suffix = reachable ? '' : '  (unreachable)';
    console.log(`  ${mark}  ${OrgRunner.orgLabel(org)}${suffix}`);
  }
}
