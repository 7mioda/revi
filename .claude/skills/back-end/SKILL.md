---
name: back-end
description: >
  Write back-end code for the Aura NestJS API (apps/api). Defines how to split a
  feature into one folder per use case: controller (HTTP I/O), input/output DTOs
  (Zod), service (single responsibility), domain entity (Zod-validated),
  factory, repository + mapper. Enforces strict separation between HTTP, domain
  and persistence layers, and forbids business logic in controllers or
  framework code in the domain.
version: 1.0.0
---

# Back-end skill (apps/api)

This document defines **non-negotiable rules** and a **folder structure** that keeps **HTTP I/O, business logic, and persistence** separated. One **use case = one folder** for the controller and one folder for the service. The domain stays pure.

## Skill Purpose

This skill assists with:

- Splitting a back-end feature into use cases inside `apps/api/src/<module>/`
- Naming and organizing controllers, DTOs, services, entities, factories, mappers and repositories
- Enforcing single-responsibility per service and one HTTP concern per controller
- Keeping domain entities free of NestJS / Prisma imports

> The architecture follows a **simplified DDD** approach (no CQRS, no domain events). The full reference lives in `apps/api/CLAUDE.md` — this skill is the operating procedure to apply it consistently.

---

## 1/ Hard Boundaries (Non-Negotiable)

### Rule 1 — Controllers never contain business logic

Controllers are an HTTP boundary. They may only:

- Parse the request via a Zod-based DTO (`createZodDto`)
- Read the authenticated `@Actor()` and route params
- Delegate to **one** service method (or a couple of repository reads for trivial GETs)
- Track analytics (Segment) and log (Winston)
- Return `{ success, data }` / `{ success, error }`

Controllers **must not**:

- Build domain entities directly (use a factory)
- Run multi-step transactions (use a service + `TransactionManager`)
- Contain `if/else` branches that encode business rules

### Rule 2 — One service = one use case = one responsibility

- File name **is** the use case: `create-playbook.service.ts`, `delete-thread.service.ts`, `start-review.service.ts`.
- A service exposes a single public method (`create`, `execute`, `start`, `find`, …). Other methods must be `private`.
- If you say "and" to describe what the service does, split it into two services.
- Services orchestrate **factories + repositories + other services** — they never instantiate concrete classes manually (always inject via NestJS DI).

### Rule 3 — Domain entities are framework-free

- Plain TypeScript classes whose constructor parses a Zod schema.
- **No** NestJS decorators, **no** Prisma imports, **no** HTTP concepts inside `entities/`.
- Default values (`createdAt`, `updatedAt`, `deletedAt`) are resolved in the constructor.
- A domain rule must be testable without spinning up Nest, Fastify or Postgres.

### Rule 4 — Persistence stays behind a repository

- All Prisma calls live in `<entity>.repository.ts`.
- The repository receives/returns **domain entities only**, never Prisma models.
- Translation is done by a static `<Entity>Mapper.toDomain()` / `toPrisma()` — pure functions.
- Multi-entity writes go through `TransactionManager.runInTransaction()` and pass the `transaction` client down to each repository call.

### Rule 5 — Errors are domain errors

- Throw `NotFoundError`, `ForbiddenError`, `BadRequestError` from `@aura/errors` (with structured payload `{ target, id, code }`).
- The global `ErrorInterceptor` maps them to HTTP — never throw `HttpException` from a service.

### Rule 6 — Validation lives at the edge AND in the domain

- API input is validated by `nestjs-zod` (`@Body() body: CreateXInputDto`).
- The domain re-validates inside entity constructors and factories — defense in depth.
- Never trust a Prisma model; always go through the entity / mapper.

---

## 2/ Folder Structure That Enforces Separation

Every domain module follows this layout:

```
apps/api/src/<module>/
├── entities/                       # Domain entities (Zod-validated TS classes)
│   ├── <entity>.ts
│   └── index.ts
├── factories/                      # Static create() with Zod + UUID
│   ├── <entity>.factory.ts
│   └── index.ts
├── controllers/
│   └── <use-case>/                 # ONE folder per HTTP use case
│       ├── <use-case>.controller.ts
│       ├── <use-case>.input.ts     # Input DTO (createZodDto)
│       ├── <use-case>.output.ts    # Output DTO (createZodDto)
│       └── index.ts                # re-exports the controller
├── services/
│   └── <use-case>/                 # ONE folder per use case (or flat file for simple modules)
│       ├── <use-case>.service.ts
│       ├── <use-case>.service.spec.ts   # co-located unit test
│       └── index.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── <entity>.repository.ts          # Prisma implementation
│   │   ├── <entity>.repository.inmemory.ts # In-memory implementation (tests)
│   │   └── index.ts
│   ├── mappers/
│   │   ├── <entity>.mapper.ts              # static toDomain() / toPrisma()
│   │   └── index.ts
│   └── infrastructure.module.ts            # registers and exports repositories
├── tests/
│   └── <entity>.fixtures.ts                # test fixtures with sensible defaults
├── constants/                              # module-level constants (optional)
└── <module>.module.ts                      # NestJS module wiring
```

### Module wiring

`<module>.module.ts` simply imports infrastructure and spreads service/controller indexes:

```ts
@Module({
  imports: [InfrastructureModule, /* other domain modules */],
  providers: [...Object.values(services)],
  controllers: [...Object.values(controllers)],
  exports: [InfrastructureModule],
})
export class ChatModule {}
```

Repositories are provided & exported by `InfrastructureModule`, so they can be reused across modules without re-binding.

---

## 3/ Naming Conventions

| Type                | Pattern                           | Example                                   |
| ------------------- | --------------------------------- | ----------------------------------------- |
| Entity              | `<entity>.ts`                     | `thread.ts`, `playbook.ts`                |
| Factory             | `<entity>.factory.ts`             | `thread.factory.ts`                       |
| Mapper              | `<entity>.mapper.ts`              | `playbook.mapper.ts`                      |
| Repository (Prisma) | `<entity>.repository.ts`          | `thread.repository.ts`                    |
| Repository (test)   | `<entity>.repository.inmemory.ts` | `playbook.repository.inmemory.ts`         |
| Service             | `<use-case>.service.ts`           | `create-playbook.service.ts`              |
| Controller          | `<use-case>.controller.ts`        | `create-thread.controller.ts`             |
| Input DTO           | `<use-case>.input.ts`             | `create-thread.input.ts`                  |
| Output DTO          | `<use-case>.output.ts`            | `start-review.output.ts`                  |
| Test                | `<use-case>.service.spec.ts`      | `populate-user-playbooks.service.spec.ts` |
| Fixture             | `<entity>.fixtures.ts`            | `playbook.fixtures.ts`                    |
| Module              | `<module>.module.ts`              | `review.module.ts`                        |

Naming is not cosmetic — `controllers/` is auto-collected via `Object.values(controllers)`; respecting the structure is required for the module to wire itself.

---

## 4/ Splitting a Feature — Decision Tree

When asked to add an endpoint, follow this order:

1. **Identify the use case** in plain English (verb + noun): *"Create a thread"*, *"Delete a thread"*, *"Start a review"*. → that's the folder name.
2. **Does it create or update a domain object?**
   - Yes → you need an **entity** (or one already exists) and a **factory** (`<Entity>Factory.create`).
3. **Does it touch the database?**
   - Yes → you need a **repository method** + **mapper**. Add to `<entity>.repository.ts` and the in-memory variant.
4. **Does it span more than one domain operation** (multiple repos, transactional writes, calls to other modules, business decisions)?
   - Yes → create a **service** under `services/<use-case>/`.
   - No (trivial GET that just reads one repo and returns the entity) → the controller may call the repository directly. Keep it pure I/O.
5. **Write the DTOs first**: `*.input.ts` and `*.output.ts` with Zod schemas + `createZodDto`.
6. **Write the controller**: thin, delegates to the service, returns the response envelope.
7. **Wire it**: re-export from `controllers/index.ts` (and `services/index.ts` if applicable). The module picks it up automatically.

---

## 5/ Patterns by Layer

### 5.1 — Input DTO

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateThreadInputSchema = z.object({
  title: z.string().optional(),
});
export class CreateThreadInputDto extends createZodDto(CreateThreadInputSchema) {}
```

- Always `createZodDto(Schema)` — never raw `class` DTOs.
- Schema is exported because controllers may `Schema.parse(body)` for an extra guard.

### 5.2 — Output DTO

Two acceptable shapes — pick one and stay consistent inside a module:

**A. Hand-rolled flat object (current default):**

```ts
export const StartReviewOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({ reviewId: z.string() }).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});
export class StartReviewOutputResponse extends createZodDto(StartReviewOutputSchema) {}
```

**B. Helper from `common/http/request.output.ts` (preferred for new code):**

```ts
import { createResponseDtoSchema } from '../../../common/http/request.output';

export const GetThreadOutputSchema = createResponseDtoSchema(
  z.object({ id: z.string(), title: z.string() }),
);
export class GetThreadOutputResponse extends createZodDto(GetThreadOutputSchema) {}
```

Why a flat object and not a discriminated union: `createZodDto` does not support `z.discriminatedUnion`. Use the flat helper for the DTO and `createResponseSchema` for client/test typing.

### 5.3 — Controller

```ts
@Controller('thread')
export class CreateThreadController {
  constructor(
    private readonly threadRepository: ThreadRepository,
    private readonly segmentService: SegmentService,
  ) {}

  @Post()
  @Guard()
  @ZodResponse({ description: '...', type: CreateThreadOutputResponse })
  async createThread(
    @Actor() actor: User,
    @Client() client: string,
    @Body() body: CreateThreadInputDto,
  ) {
    const newThread = ThreadFactory.create({ actorId: actor.id, title: body.title });
    const thread = await this.threadRepository.save(newThread);

    this.segmentService.track({ event: 'New Thread Created', userId: actor.email, properties: { ... } });

    return { success: true, data: thread };
  }
}
```

Controller checklist:

- `@Guard()` on every protected route. `@Actor()` to get the user.
- `@ZodResponse({ type })` so the OpenAPI schema is correct.
- No `try/catch` for domain errors — let the `ErrorInterceptor` handle them.
- One responsibility: parse → call service/factory → return.

### 5.4 — Service (single responsibility)

```ts
@Injectable()
export class DeleteThreadService {
  constructor(
    private readonly threadRepository: ThreadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly threadAttachmentRepository: ThreadAttachmentRepository,
    private readonly documentEditRepository: DocumentEditRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(actorId: string, threadId: string): Promise<{ id: string }> {
    const thread = await this.threadRepository.findOne({ where: { AND: [{ actorId }, { id: threadId }] } });
    if (!thread) {
      throw new NotFoundError({ target: 'Thread', id: threadId, code: 'THREAD_NOT_FOUND_OR_UNAUTHORIZED' });
    }

    await this.transactionManager.runInTransaction(async transaction => {
      await this.messageRepository.deleteMany({ threadId }, transaction);
      await this.threadAttachmentRepository.deleteByThreadId(threadId, transaction);
      await this.documentEditRepository.deleteByThreadId(threadId, transaction);
      await this.threadRepository.delete(threadId, transaction);
    });

    return { id: threadId };
  }
}
```

Service checklist:

- One public method, all helpers `private`.
- Throws domain errors (`@aura/errors`) — never `HttpException`.
- Wraps multi-entity writes in `TransactionManager.runInTransaction()` and forwards the `transaction` client to every repository call.
- Returns either a domain entity or a small primitive payload — never a Prisma model.

### 5.5 — Domain entity

```ts
export const threadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ThreadStatusEnum,
  actorId: z.string(),
  deletedAt: z.date().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ThreadInput = z.infer<typeof threadSchema>;

export class Thread {
  constructor(input: ThreadInput) {
    const parsed = threadSchema.parse(input);
    const now = new Date();
    this.id = parsed.id;
    this.title = parsed.title;
    this.status = parsed.status;
    this.actorId = parsed.actorId;
    this.deletedAt = parsed.deletedAt ?? null;
    this.createdAt = parsed.createdAt ?? now;
    this.updatedAt = parsed.updatedAt ?? now;
  }
  // public fields with JSDoc for each business meaning
}
```

### 5.6 — Factory

```ts
const createThreadSchema = z.object({
  title: z.string().optional(),
  actorId: z.string(),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

@Injectable()
export class ThreadFactory {
  static create(input: CreateThreadInput): Thread {
    const now = new Date();
    const parsed = createThreadSchema.parse(input);
    return new Thread({
      id: uuidv4(),
      title: parsed.title ?? 'New Chat',
      status: 'active',
      actorId: parsed.actorId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
```

Factories own **defaults and ID generation**. Never call `uuidv4()` directly inside a service or controller.

### 5.7 — Repository + mapper

```ts
@Injectable()
export class ThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(thread: Thread): Promise<Thread> {
    const data = ThreadMapper.toPrisma(thread);
    const saved = await this.prisma.thread.upsert({ where: { id: thread.id }, update: data, create: data });
    return ThreadMapper.toDomain(saved);
  }

  async findOne({ where }: { where: Prisma.ThreadWhereInput }): Promise<Thread | null> {
    const row = await this.prisma.thread.findFirst({ where: { ...where, deletedAt: null } });
    return row ? ThreadMapper.toDomain(row) : null;
  }
}
```

```ts
export class ThreadMapper {
  static toDomain(p: PrismaThread): Thread { return new Thread({ ... }); }
  static toPrisma(t: Thread): PrismaThread { return { ... }; }
}
```

- Mappers are **pure** static functions — no DI, no logging, no side effects.
- Repositories accept an optional `transaction?: Prisma.TransactionClient` for write methods used inside a transaction.
- Soft-delete filtering (`deletedAt: null`) lives in the repository, not in the service.

### 5.8 — In-memory repository (for tests)

Mirrors the Prisma repository's signature, backed by a `Map`:

```ts
@Injectable()
export class PlaybookRepositoryInMemory {
  private playbooks = new Map<string, Playbook>();
  async save(p: Playbook) { this.playbooks.set(p.id, p); return p; }
  async findUserPlaybooks(actorId: string) { return [...this.playbooks.values()].filter(p => p.createdBy === actorId); }
  clear() { this.playbooks.clear(); }
}
```

Swap in tests via NestJS DI:

```ts
{ provide: PlaybookRepository, useClass: PlaybookRepositoryInMemory }
```

### 5.9 — Fixture

```ts
export const playbookFixture = (input: Partial<PlaybookInput> = {}) =>
  new Playbook({ id: '1', name: 'NDA', /* sensible defaults */, ...input });
```

Use fixtures in tests and dev seeds — never hand-roll an entity inline.

---

## 6/ Import & Dependency Rules

Dependencies must flow inward: **infrastructure → application (services) → domain (entities)**.

### Allowed

- Controllers may import: services, repositories (for trivial GETs), factories, DTOs, decorators (`@aura/sentinel`), `@aura/winston`.
- Services may import: repositories, factories, entities, other services from the same or other modules, `@aura/errors`, `TransactionManager`.
- Entities may import: `zod` and other entities from the same module.
- Mappers may import: entities and Prisma generated types.

### Forbidden

- Entities **must not** import NestJS, Prisma, controllers, services or repositories.
- Services **must not** import controllers or DTOs from `controllers/<use-case>/*.input.ts` (rare exception: `CreatePlaybookService` re-uses the input DTO; if you mirror this, only import the DTO **type**, not the class instance behavior).
- Controllers **must not** import another module's controllers.
- Never `new` a service, repository, factory or mapper outside of a test — always inject via DI.
- Never bypass the mapper to hand back a Prisma model from a repository.

---

## 7/ Errors, Auth, Logging, Analytics

- **Auth:** `@Guard()` decorator + `@Actor()` to read the `User`. Never read the JWT manually unless you need to forward it (then use `@Jwt()`).
- **Errors:** throw `NotFoundError({ target, id, code? })`, `ForbiddenError({ action, resource })`, `BadRequestError(...)` from `@aura/errors`. The interceptor maps them to the HTTP envelope.
- **Logging:** inject `Winston` and log with a `context` field equal to the controller/service class name. Log at the boundary (start of the controller, before throwing).
- **Analytics:** call `SegmentService.track` from controllers (boundary), not from services. Wrap analytics in `try/catch` so a Segment failure never breaks the request.

---

## 8/ Tests

- Co-locate `*.service.spec.ts` next to the service.
- Pure-logic services (no repository): instantiate directly with `new MyService()`.
- Services with dependencies: use NestJS `Test.createTestingModule` and bind `*.repository.inmemory.ts` in place of the Prisma one.
- Build inputs with **fixtures**, not raw object literals.
- Assert on the **domain entity** returned, not on Prisma rows.

---

## 9/ Definition of Done Checklist

Before opening a PR for a back-end change:

- [ ] One folder per use case under `controllers/<use-case>/` (controller + input + output + index).
- [ ] One folder (or file) per use case under `services/<use-case>/` if business logic is non-trivial.
- [ ] Service has **one public method**; helpers are `private`.
- [ ] Controller is thin: parse → delegate → return `{ success, data | error }`.
- [ ] Input/Output DTOs use `createZodDto` and a Zod schema.
- [ ] Domain entity has a Zod-validated constructor and zero framework imports.
- [ ] New persistence calls go through a repository method (Prisma + mapper), not raw `prisma.*` in services.
- [ ] Multi-entity writes use `TransactionManager.runInTransaction()` and pass `transaction` to every repo call.
- [ ] Domain errors thrown from `@aura/errors`, never `HttpException`.
- [ ] `@Guard()` on every authenticated route, `@Actor()` used (no manual JWT parsing).
- [ ] In-memory repository updated to match the new method signature.
- [ ] Fixture exists for every new entity in `tests/<entity>.fixtures.ts`.
- [ ] Re-exported from `controllers/index.ts` / `services/index.ts` so the module picks it up automatically.
- [ ] No Prisma model leaks above the repository layer.
- [ ] Service logic is unit-testable without Postgres or NestJS HTTP.
