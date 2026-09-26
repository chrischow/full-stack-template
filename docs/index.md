# Development Docs
This document serves as an index for guidelines on contributing features. It is meant to enable the reader to selectively read documents as required for each specific task. It is NOT meant to be read sequentially from start to finish.

## General

- [Running the development environment](./general/running-the-development-environment.md): Instructions on how to start, stop, and tear down the development environment
- [Running code quality checks](./general/code-quality-checks.md): Instructions for running code quality checks after **every task** that involves code changes
- [Commit messages](./general/commit-messages.md): Guidelines for commit messages

## App: Backend

- [Creating NestJS backend components](): Process for creating NestJS backend components like modules, controllers, and services
- [Creating an API endpoint](./backend/creating-an-api-endpoint.md): Process for creating an API endpoint and its associated contract, and controller/service methods
- [Database workflow](./backend/database-workflow.md): Process for amending the database schema
- [Adding environment variables](./backend/adding-env-vars.md): Process for adding environment variables

## App: Frontend

- [Creating components](./frontend/creating-components.md): Convention for organising frontend components
- [Consuming an API endpoint](./frontend/consuming-an-api-endpoint.md): Process for using the shared contract for API queries from the frontend

## API Contract
- [Creating schemas](./api-contract/creating-schemas.md): Instructions for creating Zod schemas
- [Creating enums](./api-contract/creating-enums.md): Instructions for creating enums

## (WIP) Infra
