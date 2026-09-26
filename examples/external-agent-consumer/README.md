# External Nodra consumer proof

This fixture represents an AI company integrating Nodra from outside the Nodra monorepo.

It intentionally imports only the public package:

```js
import { Nodra } from "nodra-agent-sdk";
```

It does not import any internal Nodra source files.

CI copies this script into a clean temporary directory, installs the packed SDK tarball, and proves:

1. an external agent can authorize a consequential action,
2. a `require-approval` response can be followed automatically,
3. the runtime claims and consumes approval without human token copying,
4. the approved action becomes `allow`,
5. the external runtime can record result evidence.

The next production proof after the npm beta release is to run the same consumer against a real Nodra workspace and credential.
