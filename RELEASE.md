# Release process

This is a Yarn-workspaces monorepo with two independently versioned packages,
`dredd` and `dredd-transactions`, each following Semantic Versioning. The fork's
version line starts at the **0.1.0** baseline, reset from the inherited upstream
numbers.

## Versioning policy

- The two packages version **independently**: a change to `dredd-transactions`
  does not require a `dredd` release, and vice versa.
- When `dredd-transactions` is released and `dredd` should consume the new
  version, bump the `dredd-transactions` range in `packages/dredd/package.json`
  in the same release.
- Tags are per package, named `<package>@<version>` (e.g. `dredd@0.1.0`,
  `dredd-transactions@0.1.0`).

## Cutting a release

1. Update `version` in the relevant `packages/*/package.json` (and the internal
   `dredd-transactions` range in `packages/dredd/package.json` if it moves).
2. In `CHANGELOG.md`, move the `Unreleased` entries under a new
   `## <version> - <YYYY-MM-DD>` heading.
3. Run `yarn install --ignore-engines` so `yarn.lock` reflects the new
   version(s), then run the test suites and `lint` in both packages.
4. Commit on a release branch and open a pull request for review.

## After merge

```bash
git checkout main
git pull

# Tag the released package(s) and push the tags.
git tag -a -m 'dredd@<version>' 'dredd@<version>'
git tag -a -m 'dredd-transactions@<version>' 'dredd-transactions@<version>'
git push --tags
```

## Publishing to npm

Public npm publishing is **not yet enabled**. The source package names `dredd`
and `dredd-transactions` already exist on the public registry, so publishing
requires a distinct scoped name (for example `@stackly/...`) plus the matching
npm access. Before the first publish, finalize: the scoped package names, the
internal dependency reference and `require()` sites, `publishConfig.access`, and
the tag prefix (which follows the final package name).
