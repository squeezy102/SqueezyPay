# Audit Bibliography
## SqueezyPay Codebase Audit — Reference Sources

**Document ID:** AUDIT-BIB-001  
**Version:** 1.0  
**Date:** 2026-06-07  
**Verification method:** Each URL fetched via HTTP at time of compilation. Sources marked PASS resolved and content matched claimed title/scope. Sources marked FAIL are excluded from the bibliography and noted separately.  
**Scope:** All claims made in audit documents AUDIT-DIM-001 through AUDIT-DIM-006 and AUDIT-SUM-001 must cite at least one source from this bibliography by reference ID.

---

## 1. Python Standards

**[REF-01]** van Rossum, G., Warsaw, B., and Coghlan, A. "PEP 8 – Style Guide for Python Code." Python Software Foundation.  
https://peps.python.org/pep-0008/  
*Type: Specification. Status: PASS. Covers: naming conventions, line length, import ordering, whitespace, blank lines, comments, docstrings.*

**[REF-02]** Goodger, D. and van Rossum, G. "PEP 257 – Docstring Conventions." Python Software Foundation.  
https://peps.python.org/pep-0257/  
*Type: Specification. Status: PASS. Covers: one-line docstrings, multi-line docstrings, indentation, spacing.*

**[REF-03]** van Rossum, G. et al. "PEP 484 – Type Hints." Python Software Foundation.  
https://peps.python.org/pep-0484/  
*Type: Specification. Status: PASS. Covers: function annotation syntax, Optional, Union, type aliases, forward references.*

**[REF-04]** Gonzalez, R. et al. "PEP 526 – Syntax for Variable Annotations." Python Software Foundation.  
https://peps.python.org/pep-0526/  
*Type: Specification. Status: PASS. Covers: annotated assignment syntax for variables and class variables.*

**[REF-05]** Bierbaum, K. "PEP 604 – Allow writing union types as X | Y." Python Software Foundation.  
https://peps.python.org/pep-0604/  
*Type: Specification. Status: PASS. Covers: modern union syntax available Python 3.10+.*

**[REF-06]** Peters, T. "PEP 20 – The Zen of Python." Python Software Foundation.  
https://peps.python.org/pep-0020/  
*Type: Specification. Status: PASS. Covers: guiding design principles for Python code.*

**[REF-07]** Python Packaging Authority. "pyproject.toml specification." PyPA.  
https://packaging.python.org/en/latest/specifications/pyproject-toml/  
*Type: Specification. Status: PASS. Covers: build system declaration, project metadata, tool configuration in pyproject.toml.*

---

## 2. Security

**[REF-08]** OWASP Foundation. "OWASP Top Ten Web Application Security Risks." OWASP Foundation.  
https://owasp.org/www-project-top-ten/  
*Type: Standard. Status: PASS. Edition: 2021. Covers: A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, A07 Authentication Failures, A08 Software Integrity Failures, A09 Logging Failures, A10 SSRF.*

**[REF-09]** OWASP Foundation. "OWASP Application Security Verification Standard (ASVS)." OWASP Foundation.  
https://owasp.org/www-project-application-security-verification-standard/  
*Type: Standard. Status: PASS. Version: 4.0. Covers: authentication, session management, access control, cryptography, error handling, data protection, communication security.*

**[REF-10]** Turan, M., Barker, E., Burr, W., and Chen, L. "NIST SP 800-132: Recommendation for Password-Based Key Derivation, Part 1: Storage Applications." National Institute of Standards and Technology.  
https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf  
*Type: Standard. Status: PASS. Covers: minimum iteration counts for PBKDF, salt length requirements, key derivation for storage.*

**[REF-11]** Jones, M., Bradley, J., and Sakimura, N. "RFC 7519 – JSON Web Token (JWT)." Internet Engineering Task Force.  
https://datatracker.ietf.org/doc/html/rfc7519  
*Type: Standard. Status: PASS. Covers: JWT structure, claims (iss, sub, aud, exp, nbf, iat, jti), algorithm requirements.*

**[REF-12]** Hardt, D. "RFC 6749 – The OAuth 2.0 Authorization Framework." Internet Engineering Task Force.  
https://datatracker.ietf.org/doc/html/rfc6749  
*Type: Standard. Status: PASS. Covers: authorization flows, token types, scopes, client authentication.*

**[REF-13]** OWASP Foundation. "Cryptographic Storage Cheat Sheet." OWASP Cheat Sheet Series.  
https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html  
*Type: Documentation. Status: PASS. Covers: algorithm selection, key management, where to store keys, Fernet/AES usage guidance.*

**[REF-14]** OWASP Foundation. "REST Security Cheat Sheet." OWASP Cheat Sheet Series.  
https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html  
*Type: Documentation. Status: PASS. Covers: HTTPS enforcement, CORS configuration, HTTP method restriction, input validation, error handling in REST APIs.*

**[REF-15]** OWASP Foundation. "Input Validation Cheat Sheet." OWASP Cheat Sheet Series.  
https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html  
*Type: Documentation. Status: PASS. Covers: allowlist vs denylist validation, length checks, type validation, sanitization.*

**[REF-16]** OWASP Foundation. "JSON Web Token Cheat Sheet for Java." OWASP Cheat Sheet Series.  
https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html  
*Type: Documentation. Status: PASS. Note: title references Java but principles (algorithm pinning, expiry validation, secret storage) are language-agnostic. Covers: algorithm confusion attacks, token storage, expiry enforcement.*

---

## 3. FastAPI and Python Web

**[REF-17]** Ramirez, S. "Security." FastAPI Documentation.  
https://fastapi.tiangolo.com/tutorial/security/  
*Type: Documentation. Status: PASS. Covers: OAuth2PasswordBearer, token-based auth, dependency injection for auth, HTTP Basic.*

**[REF-18]** Ramirez, S. "CORS (Cross-Origin Resource Sharing)." FastAPI Documentation.  
https://fastapi.tiangolo.com/tutorial/cors/  
*Type: Documentation. Status: PASS. Covers: CORSMiddleware configuration, allow_origins, allow_methods, allow_headers, credentials.*

**[REF-19]** SQLAlchemy Authors. "ORM Quick Start." SQLAlchemy 2.0 Documentation.  
https://docs.sqlalchemy.org/en/20/orm/quickstart.html  
*Type: Documentation. Status: PASS. Covers: DeclarativeBase, mapped_column, Session usage, relationship declarations.*

**[REF-20]** SQLAlchemy Authors. "Tutorial." Alembic 1.18.4 Documentation.  
https://alembic.sqlalchemy.org/en/latest/tutorial.html  
*Type: Documentation. Status: PASS. Covers: migration environment setup, upgrade/downgrade functions, autogenerate, revision chaining.*

---

## 4. TypeScript and React

**[REF-21]** Microsoft Corporation. "TSConfig Reference – Docs on every TSConfig option." TypeScript.  
https://www.typescriptlang.org/tsconfig  
*Type: Documentation. Status: PASS. Covers: strict, noImplicitAny, strictNullChecks, target, module, lib, paths, all compiler options.*

**[REF-22]** Google LLC. "Google TypeScript Style Guide." Google.  
https://google.github.io/styleguide/tsguide.html  
*Type: Style Guide. Status: PASS. Covers: file naming, import ordering, type vs interface, any usage, visibility, class members, comments.*

**[REF-23]** Meta Platforms, Inc. "Rules of Hooks." React Documentation.  
https://react.dev/reference/rules/rules-of-hooks  
*Type: Documentation. Status: PASS. Covers: only call hooks at the top level, only call hooks from React functions, hook dependency rules.*

**[REF-24]** Meta Platforms, Inc. "Components and Hooks must be pure." React Documentation.  
https://react.dev/reference/rules/components-and-hooks-must-be-pure  
*Type: Documentation. Status: PASS. Covers: idempotency requirement, side effect placement, disallowed calls during render (Date.now, Math.random, etc.).*

**[REF-25]** TanStack. "Overview." TanStack Query v5 Documentation.  
https://tanstack.com/query/latest/docs/framework/react/overview  
*Type: Documentation. Status: PASS. Covers: useQuery, useMutation, queryKey conventions, staleTime, gcTime, QueryClient configuration.*

---

## 5. CI/CD and GitHub

**[REF-26]** GitHub, Inc. "Security hardening for GitHub Actions." GitHub Docs.  
https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions  
*Type: Documentation. Status: PASS. Note: page title displayed as "Secure use reference" at time of fetch — content scope confirmed as security hardening. Covers: pinning action versions to SHA, secret scoping, GITHUB_TOKEN permissions, injection risks in run steps.*

**[REF-27]** GitHub, Inc. "Workflow syntax for GitHub Actions." GitHub Docs.  
https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions  
*Type: Documentation. Status: PASS. Covers: on triggers, jobs, steps, needs, env, secrets, defaults, permissions.*

**[REF-28]** GitHub, Inc. "Keeping your actions up to date with Dependabot." GitHub Docs.  
https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot  
*Type: Documentation. Status: PASS. Covers: dependabot.yml configuration for GitHub Actions version updates.*

---

## 6. Accessibility

**[REF-29]** Caldwell, B. et al. "Web Content Accessibility Guidelines (WCAG) 2.1." W3C Recommendation. World Wide Web Consortium.  
https://www.w3.org/TR/WCAG21/  
*Type: Standard. Status: PASS. Covers: perceivable, operable, understandable, robust criteria. Relevant: 1.3.1 Info and Relationships, 2.1.1 Keyboard, 4.1.2 Name Role Value.*

**[REF-30]** Diggs, J. et al. "Accessible Rich Internet Applications (WAI-ARIA) 1.2." W3C Recommendation. World Wide Web Consortium.  
https://www.w3.org/TR/wai-aria-1.2/  
*Type: Standard. Status: PASS. Covers: role definitions, aria-label, aria-labelledby, aria-describedby, live regions, widget roles.*

---

## 7. Database

**[REF-31]** SQLite Consortium. "Datatypes In SQLite." SQLite Documentation.  
https://www.sqlite.org/datatype3.html  
*Type: Documentation. Status: PASS. Covers: type affinity rules, storage classes (NULL, INTEGER, REAL, TEXT, BLOB), type coercion behavior.*

**[REF-32]** SQLAlchemy Authors. "Operation Reference." Alembic 1.18.4 Documentation.  
https://alembic.sqlalchemy.org/en/latest/ops.html  
*Type: Documentation. Status: PASS. Covers: create_table, drop_table, add_column, drop_column, create_index, drop_index, create_foreign_key, batch_alter_table.*

---

## 8. PowerShell

**[REF-33]** Microsoft Corporation. "Strongly Encouraged Development Guidelines." Microsoft Learn — PowerShell Scripting.  
https://learn.microsoft.com/en-us/powershell/scripting/developer/cmdlet/strongly-encouraged-development-guidelines  
*Type: Documentation. Status: PASS. Covers: error handling, parameter validation, output objects, verb-noun naming, ShouldProcess for destructive operations.*

---

## 9. Testing

**[REF-34]** pytest Development Team. "pytest: helps you write better programs." pytest Documentation.  
https://docs.pytest.org/en/stable/  
*Type: Documentation. Status: PASS. Covers: fixture scoping, parametrize, conftest.py, assert rewriting, coverage integration.*

**[REF-35]** Stewart, S. "Test Sizes." Google Testing Blog. Google LLC.  
https://testing.googleblog.com/2010/12/test-sizes.html  
*Type: Article. Status: PASS. Covers: small/medium/large test classification, isolation requirements, hermetic test principles.*

---

## 10. Dependency Security

**[REF-36]** Python Packaging Authority. "Python Packaging Advisory Database." PyPA.  
https://github.com/pypa/advisory-database  
*Type: Repository/Database. Status: PASS. Covers: known CVEs and security advisories for Python packages published to PyPI.*

**[REF-37]** npm, Inc. "npm-audit." npm CLI v10 Documentation.  
https://docs.npmjs.com/cli/v10/commands/npm-audit  
*Type: Documentation. Status: PASS. Covers: vulnerability scanning of npm dependency trees, severity levels, fix recommendations.*

---

## Excluded Sources

The following source was verified and found inaccessible at time of compilation and is therefore excluded:

| Source | URL | Reason |
|--------|-----|--------|
| eslint-plugin-react-hooks README | https://www.npmjs.com/package/eslint-plugin-react-hooks | HTTP 403 Forbidden |

*Alternative citation for eslint-plugin-react-hooks behavior: [REF-23] and [REF-24] (React official documentation on hook rules and purity, which the plugin enforces).*

---

## Reference Index (Quick Lookup)

| ID | Subject | Category |
|----|---------|----------|
| REF-01 | PEP 8 — Python style | Python Standards |
| REF-02 | PEP 257 — Docstrings | Python Standards |
| REF-03 | PEP 484 — Type hints | Python Standards |
| REF-04 | PEP 526 — Variable annotations | Python Standards |
| REF-05 | PEP 604 — Union X\|Y syntax | Python Standards |
| REF-06 | PEP 20 — Zen of Python | Python Standards |
| REF-07 | pyproject.toml spec | Python Standards |
| REF-08 | OWASP Top 10 (2021) | Security |
| REF-09 | OWASP ASVS 4.0 | Security |
| REF-10 | NIST SP 800-132 | Security |
| REF-11 | RFC 7519 — JWT | Security |
| REF-12 | RFC 6749 — OAuth 2.0 | Security |
| REF-13 | OWASP Cryptographic Storage | Security |
| REF-14 | OWASP REST Security | Security |
| REF-15 | OWASP Input Validation | Security |
| REF-16 | OWASP JWT Cheat Sheet | Security |
| REF-17 | FastAPI Security docs | FastAPI/Python Web |
| REF-18 | FastAPI CORS docs | FastAPI/Python Web |
| REF-19 | SQLAlchemy 2.0 ORM docs | FastAPI/Python Web |
| REF-20 | Alembic Tutorial | FastAPI/Python Web |
| REF-21 | TypeScript tsconfig reference | TypeScript/React |
| REF-22 | Google TypeScript Style Guide | TypeScript/React |
| REF-23 | React Rules of Hooks | TypeScript/React |
| REF-24 | React purity rules | TypeScript/React |
| REF-25 | TanStack Query v5 docs | TypeScript/React |
| REF-26 | GitHub Actions security hardening | CI/CD |
| REF-27 | GitHub Actions workflow syntax | CI/CD |
| REF-28 | GitHub Dependabot for Actions | CI/CD |
| REF-29 | WCAG 2.1 | Accessibility |
| REF-30 | WAI-ARIA 1.2 | Accessibility |
| REF-31 | SQLite Datatypes | Database |
| REF-32 | Alembic Operations Reference | Database |
| REF-33 | Microsoft PowerShell guidelines | PowerShell |
| REF-34 | pytest documentation | Testing |
| REF-35 | Google Testing Blog — Test Sizes | Testing |
| REF-36 | PyPI Advisory Database | Dependency Security |
| REF-37 | npm audit documentation | Dependency Security |
