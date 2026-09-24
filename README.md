# APGC Platform

Public browser clients for the APGC research demonstration.

The desktop wallet is deployed at the GitHub Pages root. The mobile wallet and
chain monitor remain available under `/wallet/` and `/monitor/`.

- `AnonymousPGC-Web/wallet`: mobile wallet interface
- `AnonymousPGC-Web/chain-monitor`: genesis and chain monitor interface
- `AnonymousPGC-Web-Desktop`: desktop wallet interface
- `AnonymousPGC-Web/shared`: shared API client and presentation components

The deployed clients connect to the HTTPS test API configured in the GitHub
Pages workflow. This repository contains no server credentials, private keys,
or production assets.

> This project is for research and technical demonstration only. All balances,
> accounts, and transactions use a local test chain and have no monetary value.
