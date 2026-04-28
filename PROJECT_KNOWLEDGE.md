# Reactivities — Comprehensive Project Knowledge Document

> Generated: 2026-04-28

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Map](#2-architecture-map)
3. [Backend — .NET Layer](#3-backend--net-layer)
   - 3.1 [Project Structure](#31-project-structure)
   - 3.2 [Domain Layer](#32-domain-layer)
   - 3.3 [Persistence Layer](#33-persistence-layer)
   - 3.4 [Application Layer — CQRS + MediatR](#34-application-layer--cqrs--mediatr)
   - 3.5 [Infrastructure Layer](#35-infrastructure-layer)
   - 3.6 [API Layer](#36-api-layer)
   - 3.7 [NuGet Packages Reference](#37-nuget-packages-reference)
4. [Frontend — React/TypeScript Layer](#4-frontend--reacttypescript-layer)
   - 4.1 [Project Structure](#41-project-structure)
   - 4.2 [State Management — MobX + React Query](#42-state-management--mobx--react-query)
   - 4.3 [API Communication — Axios](#43-api-communication--axios)
   - 4.4 [Forms & Validation — React Hook Form + Zod](#44-forms--validation--react-hook-form--zod)
   - 4.5 [Real-Time — SignalR](#45-real-time--signalr)
   - 4.6 [UI — Material UI + Leaflet + react-cropper](#46-ui--material-ui--leaflet--react-cropper)
   - 4.7 [npm Package Reference](#47-npm-package-reference)
5. [Shared Architectural Patterns](#5-shared-architectural-patterns)
   - 5.1 [CQRS Pattern](#51-cqrs-pattern)
   - 5.2 [Result Pattern](#52-result-pattern)
   - 5.3 [Cursor-Based Pagination](#53-cursor-based-pagination)
   - 5.4 [Optimistic Updates](#54-optimistic-updates)
   - 5.5 [Authentication — ASP.NET Identity + Cookie Auth](#55-authentication--aspnet-identity--cookie-auth)
   - 5.6 [Authorization — Custom Policy](#56-authorization--custom-policy)
6. [Configuration & Infrastructure](#6-configuration--infrastructure)
7. [Non-Obvious Decisions & Gotchas](#7-non-obvious-decisions--gotchas)

---

## 1. Project Overview

**Reactivities** is a social activity management platform — a LinkedIn-meets-Meetup app where users can:

| Feature | Detail |
|---|---|
| Activity CRUD | Create, read, update, delete events with date, location, category |
| Attendance | Join/leave events; host can cancel without deleting |
| Real-time comments | SignalR WebSocket chat on each activity detail page |
| Photo management | Upload photos to Cloudinary, set profile picture |
| Following system | Follow/unfollow other users, see follower/following counts |
| Filtering | View all activities, only ones you're attending, or only ones you're hosting |
| Infinite scroll | Cursor-based paginated activity feed |
| Maps | Leaflet maps with LocationIQ geocoding on activity form |

**Seed data**: 3 users (Bob, Tom, Jane — password `Pa$$w0rd`), 9 activities across London and Paris in categories: drinks, culture, music, travel, film.

---

## 2. Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│  React 19 SPA (Vite 7, TypeScript 5.8)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ React Query │ │  MobX Stores │ │  React Hook Form + Zod│ │
│  │ (server     │ │  (UI state,  │ │  (form management     │ │
│  │  cache)     │ │   filters)   │ │   + validation)       │ │
│  └──────┬──────┘ └──────────────┘ └───────────────────────┘ │
│         │ Axios (withCredentials)  SignalR WS                │
└─────────┼─────────────────────────────────────────────────────┘
          │ HTTPS + Cookies
┌─────────▼─────────────────────────────────────────────────────┐
│  ASP.NET Core 10 API                                           │
│  ┌──────────────┐ ┌───────────────────────────────────────┐   │
│  │  Controllers │ │  ExceptionMiddleware                  │   │
│  │  (REST)      │ │  CommentHub (SignalR)                  │   │
│  └──────┬───────┘ └───────────────────────────────────────┘   │
│         │ MediatR Send()                                        │
│  ┌──────▼────────────────────────────────────────────────────┐ │
│  │  Application Layer (CQRS)                                 │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐ │ │
│  │  │ Commands │ │ Queries  │ │ Validators│ │ AutoMapper │ │ │
│  │  │(MediatR) │ │(MediatR) │ │  (Fluent) │ │  Profiles  │ │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └────────────┘ │ │
│  └──────┬────────────────────────────────────────────────────┘ │
│         │ EF Core / Cloudinary SDK                              │
│  ┌──────▼────────┐  ┌──────────────────────────────────────┐   │
│  │  Persistence  │  │  Infrastructure                      │   │
│  │  SQL Server   │  │  Cloudinary (photos)                 │   │
│  │  EF Core 10   │  │  UserAccessor, IsHostHandler         │   │
│  └───────────────┘  └──────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend — .NET Layer

### 3.1 Project Structure

The backend follows a **Clean Architecture** with 5 .NET projects (one solution file: `Reactivities.slnx`):

```
API/           → Entry point: controllers, middleware, SignalR, Program.cs
Application/   → Business logic: CQRS handlers, DTOs, validators, AutoMapper
Domain/        → Entity models only — no dependencies
Persistence/   → EF Core DbContext + database initializer
Infrastructure/→ External services: Cloudinary, JWT accessor, auth handlers
```

Dependency direction: `API → Application → Domain`. `Infrastructure → Application`. `Persistence → Domain`.  
Neither `Domain` nor `Application` depends on `Infrastructure` or `Persistence` — they depend only on interfaces.

---

### 3.2 Domain Layer

**Package**: `Microsoft.AspNetCore.Identity.EntityFrameworkCore v9.0.1`  
Required so `User` can extend `IdentityUser`, giving free email/password/claims support.

#### Domain Models

**`Activity`**
```csharp
public class Activity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string Title { get; set; }
    public DateTime Date { get; set; }
    public required string Description { get; set; }
    public required string Category { get; set; }
    public required string City { get; set; }
    public required string Venue { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsCancelled { get; set; }
    public ICollection<ActivityAttendee> Attendees { get; set; } = [];
    public ICollection<Comment> Comments { get; set; } = [];
}
```

**`User`** (extends `IdentityUser`)
```csharp
public class User : IdentityUser
{
    public required string DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? ImageUrl { get; set; }
    public ICollection<ActivityAttendee> Activities { get; set; } = [];
    public ICollection<Photo> Photos { get; set; } = [];
    public ICollection<UserFollowing> Followings { get; set; } = [];
    public ICollection<UserFollowing> Followers { get; set; } = [];
}
```

**`ActivityAttendee`** — join table between User and Activity
```csharp
public class ActivityAttendee
{
    public string UserId { get; set; } = "";
    public User? User { get; set; }
    public string ActivityId { get; set; } = "";
    public Activity? Activity { get; set; }
    public bool IsHost { get; set; }
    public DateTime DateJoined { get; set; }
}
```

**`UserFollowing`** — self-referencing join table
```csharp
public class UserFollowing
{
    public string ObserverId { get; set; } = "";
    public User? Observer { get; set; }
    public string TargetId { get; set; } = "";
    public User? Target { get; set; }
}
```

**`Comment`**
```csharp
public class Comment
{
    public int Id { get; set; }
    public required string Body { get; set; }
    public required User User { get; set; }
    public string UserId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

**`Photo`**
```csharp
public class Photo
{
    public required string Id { get; set; }
    public required string Url { get; set; }
    public string? PublicId { get; set; }  // Cloudinary reference for deletion
    public string UserId { get; set; } = "";
}
```

---

### 3.3 Persistence Layer

**Package**: `Microsoft.EntityFrameworkCore.SqlServer v10.0.7`

#### `AppDbContext`

Extends `IdentityDbContext<User>` (adds Identity tables). Key configuration:

```csharp
// Composite key for join tables
modelBuilder.Entity<ActivityAttendee>()
    .HasKey(aa => new { aa.UserId, aa.ActivityId });

modelBuilder.Entity<UserFollowing>()
    .HasKey(uf => new { uf.ObserverId, uf.TargetId });

// Self-referencing many-to-many for followers
modelBuilder.Entity<UserFollowing>()
    .HasOne(f => f.Observer)
    .WithMany(u => u.Followings)
    .HasForeignKey(f => f.ObserverId)
    .OnDelete(DeleteBehavior.Cascade);

modelBuilder.Entity<UserFollowing>()
    .HasOne(f => f.Target)
    .WithMany(u => u.Followers)
    .HasForeignKey(f => f.TargetId)
    .OnDelete(DeleteBehavior.NoAction);  // Prevents circular cascade

// UTC converter for all DateTime columns
var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
    v => v.ToUniversalTime(),
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
// Applied to every DateTime property via model-level loop

// Index on Activity.Date (for efficient cursor pagination)
modelBuilder.Entity<Activity>()
    .HasIndex(a => a.Date);
```

**Why `NoAction` on Target delete?** SQL Server cannot have two cascade delete paths to the same table (would cause "multiple cascade paths" error). The Observer side gets `Cascade`, Target gets `NoAction`.

#### `DbInitializer`

Called at startup — runs `Migrate()` to auto-apply migrations, then seeds if no activities exist. Seeds 3 users with `UserManager` (properly hashes passwords) and 9 activities with `ActivityAttendee` records.

---

### 3.4 Application Layer — CQRS + MediatR

**Packages**:
- `MediatR v12.5.0` — mediator pattern dispatcher
- `AutoMapper v13.0.1` — object-to-object mapping
- `FluentValidation.DependencyInjectionExtensions v11.11.0` — validation pipeline

#### MediatR — How It Works Here

MediatR decouples controllers from business logic. Instead of calling a service directly, a controller sends a **request** object to MediatR, which finds the **handler** and runs it.

```csharp
// In ActivitiesController:
[HttpGet]
public async Task<ActionResult<PagedList<ActivityDto, DateTime>>> GetActivities(
    [FromQuery] ActivityParams param)
{
    return HandleResult(await Mediator.Send(new GetActivityList.Query { Params = param }));
}

// In Application/Activities/Queries/GetActivityList.cs:
public class Query : IRequest<Result<PagedList<ActivityDto, DateTime>>>
{
    public required ActivityParams Params { get; set; }
}

public class Handler(AppDbContext context, IMapper mapper, IUserAccessor accessor)
    : IRequestHandler<Query, Result<PagedList<ActivityDto, DateTime>>>
{
    public async Task<Result<PagedList<ActivityDto, DateTime>>> Handle(
        Query request, CancellationToken cancellationToken)
    {
        // ... business logic
    }
}
```

**MediatR Pipeline Behaviour**: `ValidationBehaviour<TRequest, TResponse>` runs before every handler. It finds all `IValidator<TRequest>` implementations and throws `ValidationException` if any rules fail. The `ExceptionMiddleware` catches `ValidationException` and formats it as HTTP 400.

```csharp
// Registered in Program.cs:
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblyContaining<GetActivityList.Handler>();
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));
});
```

#### CQRS Handlers Summary

| Handler | Type | Returns |
|---|---|---|
| `GetActivityList.Query` | Query | `PagedList<ActivityDto, DateTime>` |
| `GetActivityDetails.Query` | Query | `ActivityDto` |
| `GetComments.Query` | Query | `List<CommentDto>` |
| `GetProfile.Query` | Query | `UserProfile` |
| `GetFollowings.Query` | Query | `List<UserProfile>` |
| `GetProfilePhotos.Query` | Query | `List<Photo>` |
| `CreateActivity.Command` | Command | `string` (activityId) |
| `EditActivity.Command` | Command | `Unit` |
| `DeleteActivity.Command` | Command | `Unit` |
| `UpdateAttendance.Command` | Command | `Unit` |
| `AddComment.Command` | Command | `CommentDto` |
| `AddPhoto.Command` | Command | `Photo` |
| `DeletePhoto.Command` | Command | `Unit` |
| `SetMainPhoto.Command` | Command | `Unit` |
| `FollowToggle.Command` | Command | `Unit` |

#### AutoMapper — Projection with Runtime Parameters

The mapper is used with `ProjectTo<T>()` directly on EF Core `IQueryable`, so SQL joins/projections happen in the database — not in memory:

```csharp
// In GetActivityList.Handler:
var activities = await query
    .ProjectTo<ActivityDto>(mapper.ConfigurationProvider,
        new { currentUserId = accessor.GetUserId() })
    .ToListAsync(cancellationToken);
```

The `new { currentUserId }` anonymous object passes a runtime parameter to the mapping profile. This is needed because `IsHost`, `IsGoing`, and `Following` are computed fields that depend on who is asking:

```csharp
// In MappingProfiles:
CreateMap<ActivityAttendee, UserProfile>()
    .ForMember(d => d.DisplayName, o => o.MapFrom(s => s.User!.DisplayName))
    .ForMember(d => d.Following, o => o.MapFrom(s =>
        s.User!.Followers.Any(f => f.ObserverId == currentUserId)));

CreateMap<Activity, ActivityDto>()
    .ForMember(d => d.IsHost, o => o.MapFrom(s =>
        s.Attendees.Any(a => a.IsHost && a.UserId == currentUserId)))
    .ForMember(d => d.IsGoing, o => o.MapFrom(s =>
        s.Attendees.Any(a => !a.IsHost && a.UserId == currentUserId)));
```

**Key concept**: `string? currentUserId` must be declared as a field in the `MappingProfiles` class for the anonymous parameter injection to work with `ProjectTo`.

#### FluentValidation

Base class pattern avoids repeating rules across Create and Edit:

```csharp
public class BaseActivityValidator<T, TDto> : AbstractValidator<T>
    where TDto : BaseActivityDto
{
    protected BaseActivityValidator(Expression<Func<T, TDto>> dtoSelector)
    {
        RuleFor(x => dtoSelector.Compile()(x).Title)
            .NotEmpty().MaximumLength(100);
        RuleFor(x => dtoSelector.Compile()(x).Date)
            .GreaterThan(DateTime.Now).WithMessage("Date must be in the future");
        // ... other rules
    }
}

public class CreateActivityValidator : BaseActivityValidator<CreateActivity.Command, CreateActivityDto>
{
    public CreateActivityValidator() : base(x => x.ActivityDto) { }
}
```

---

### 3.5 Infrastructure Layer

**Package**: `CloudinaryDotNet v1.27.2`

#### `PhotoService`

Handles Cloudinary upload and deletion. Takes `IFormFile`, streams it to Cloudinary, returns a URL + PublicId pair:

```csharp
public async Task<PhotoUploadResult> UploadPhoto(IFormFile file)
{
    var uploadParams = new ImageUploadParams
    {
        File = new FileDescription(file.FileName, file.OpenReadStream()),
        Transformation = new Transformation().Height(500).Width(500).Crop("fill")
    };
    var result = await cloudinary.UploadAsync(uploadParams);
    // ...
}
```

Photo deletion uses `PublicId` (the Cloudinary asset identifier, not the URL).

#### `UserAccessor`

Reads `ClaimsPrincipal` from `IHttpContextAccessor` to get the current user's ID. Used by handlers to know who is acting:

```csharp
public class UserAccessor(IHttpContextAccessor accessor) : IUserAccessor
{
    public string GetUserId() =>
        accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();
}
```

#### `IsHostRequirementHandler`

Custom ASP.NET Core authorization policy handler. For edit/delete endpoints, it checks that the current user is the host of the activity being acted on:

```csharp
// Extracts activityId from route
var activityId = httpContext.GetRouteValue("id")?.ToString();
// Queries the join table
var isHost = await dbContext.ActivityAttendees.AnyAsync(
    a => a.ActivityId == activityId && a.UserId == userId && a.IsHost);
```

Registered as `IsActivityHost` policy in `Program.cs`. Applied via `[Authorize(Policy = "IsActivityHost")]` on PUT/DELETE activity endpoints.

---

### 3.6 API Layer

**Package**: `Microsoft.EntityFrameworkCore.Design v10.0.2` (needed for `dotnet ef` CLI migrations only)

#### `Program.cs` — Key Registrations

```csharp
// Global authorization — every endpoint requires login unless [AllowAnonymous]
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("IsActivityHost", policy =>
        policy.Requirements.Add(new IsHostRequirement()));

// EF Core + SQL Server
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Identity with cookie authentication (no JWT!)
builder.Services.AddIdentityApiEndpoints<User>()
    .AddEntityFrameworkStores<AppDbContext>();

// MediatR + validation pipeline
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssemblyContaining<GetActivityList.Handler>();
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));
});

// Auto-register all FluentValidation validators in Application assembly
builder.Services.AddValidatorsFromAssemblyContaining<CreateActivityValidator>();

// CORS with credentials (required for cookie auth from a different origin)
builder.Services.AddCors(opt =>
    opt.AddPolicy("CorsPolicy", policy =>
        policy.AllowAnyHeader().AllowAnyMethod()
            .WithOrigins("http://localhost:3000", "https://localhost:3000")
            .AllowCredentials()));

// SignalR
builder.Services.AddSignalR();
app.MapHub<CommentHub>("/comments");

// Serve React SPA
app.UseStaticFiles();
app.MapFallbackToFile("index.html");
```

#### `BaseApiController`

All controllers inherit this — provides `Mediator` and a `HandleResult` helper:

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BaseApiController : ControllerBase
{
    private IMediator? mediator;
    protected IMediator Mediator =>
        mediator ??= HttpContext.RequestServices.GetRequiredService<IMediator>();

    protected ActionResult HandleResult<T>(Result<T>? result)
    {
        if (result == null) return NotFound();
        if (result.IsSuccess) return result.Value == null ? NotFound() : Ok(result.Value);
        return result.Code switch {
            ResultCode.NotFound => NotFound(result.Error),
            ResultCode.Forbidden => Forbid(),
            _ => BadRequest(result.Error)
        };
    }
    // Overload for paged results returns with pagination headers
}
```

#### `ExceptionMiddleware`

Sits at the top of the pipeline, catches all exceptions:

```csharp
catch (ValidationException ex)
{
    context.Response.StatusCode = 400;
    var errors = ex.Errors.Select(e => e.ErrorMessage).ToArray();
    await context.Response.WriteAsJsonAsync(errors);
}
catch (Exception ex)
{
    context.Response.StatusCode = 500;
    var error = new AppException(500, ex.Message,
        env.IsDevelopment() ? ex.StackTrace : null);
    await context.Response.WriteAsJsonAsync(error);
}
```

#### `CommentHub` (SignalR)

```csharp
public class CommentHub(IMediator mediator) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var activityId = Context.GetHttpContext()!.Request.Query["activityId"];
        await Groups.AddToGroupAsync(Context.ConnectionId, activityId!);
        var comments = await mediator.Send(new GetComments.Query { ActivityId = activityId! });
        await Clients.Caller.SendAsync("LoadComments", comments.Value);
    }

    public async Task SendComment(AddComment.Command command)
    {
        var comment = await mediator.Send(command);
        await Clients.Group(command.ActivityId)
            .SendAsync("ReceiveComment", comment.Value);
    }
}
```

**Key concept**: SignalR groups are keyed by `activityId`, so comments only broadcast to users viewing the same activity.

#### `FallbackController`

Serves `index.html` for any non-API, non-file route — required for React Router client-side routing to work when the app is deployed as a single server:

```csharp
[AllowAnonymous]
public class FallbackController : Controller
{
    public IActionResult Index() => PhysicalFile(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "index.html"),
        "text/HTML");
}
```

---

### 3.7 NuGet Packages Reference

| Package | Version | Project | Purpose |
|---|---|---|---|
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | 9.0.1 | Domain | Lets `User` extend `IdentityUser`; provides auth tables |
| `Microsoft.EntityFrameworkCore.SqlServer` | 10.0.7 | Persistence | EF Core driver for SQL Server |
| `Microsoft.EntityFrameworkCore.Design` | 10.0.2 | API | `dotnet ef` CLI tooling for migrations |
| `MediatR` | 12.5.0 | Application | In-process messaging / CQRS dispatcher |
| `AutoMapper` | 13.0.1 | Application | Object-to-object mapping, EF Core `ProjectTo` |
| `FluentValidation.DependencyInjectionExtensions` | 11.11.0 | Application | Declarative validation with DI auto-registration |
| `CloudinaryDotNet` | 1.27.2 | Infrastructure | Photo upload/delete to Cloudinary CDN |

---

## 4. Frontend — React/TypeScript Layer

### 4.1 Project Structure

```
client/src/
├── app/
│   ├── layout/         → App.tsx (root), NavBar, UserMenu
│   ├── router/         → Routes.tsx (React Router config), RequireAuth guard
│   └── shared/
│       └── components/ → Reusable: TextInput, SelectInput, DateTimeInput,
│                          PhotoUploadWidget, LocationInput, MapComponent, etc.
├── features/
│   ├── activities/     → Dashboard, List, Card, Filters, DetailsPage, Form
│   ├── profiles/       → ProfilePage, Header, Content, Photos, Followings
│   ├── account/        → LoginForm, RegisterForm
│   └── home/           → HomePage
└── lib/
    ├── api/            → agent.ts (Axios instance + all API calls)
    ├── stores/         → store.ts, uiStore.ts, activityStore.ts, counterStore.ts
    ├── hooks/          → useActivities, useProfile, useAccount, useComments, useStore
    ├── schemas/        → activitySchema.ts, loginSchema.ts, registerSchema.ts
    ├── types/          → index.d.ts (all TypeScript types)
    └── util/           → formatDate, timeAgo, requiredString helper
```

---

### 4.2 State Management — MobX + React Query

This project uses **two state managers with different scopes** — a deliberate separation of concerns:

| Library | Manages | Why |
|---|---|---|
| **React Query** | Server state (activities, profiles, user) | Caching, background refetch, mutation lifecycle |
| **MobX** | UI/client state (active filters, loading spinner, date range) | Observable reactive state for non-server data |

#### MobX

`mobx v6.15.0` + `mobx-react-lite v4.1.1`

MobX makes JavaScript objects **reactive** — when an observable changes, any component that reads it automatically re-renders.

**Root store pattern** — a single `store.ts` provides all sub-stores via React context:

```typescript
// lib/stores/store.ts
class Store {
    counterStore = new CounterStore();
    uiStore = new UIStore();
    activityStore = new ActivityStore();
}
export const store = new Store();
export const StoreContext = createContext(store);

// lib/hooks/useStore.ts
export function useStore() {
    return useContext(StoreContext);
}
```

**`uiStore.ts`** — tracks global loading state driven by Axios interceptors:

```typescript
class UIStore {
    isLoading = false;

    constructor() { makeAutoObservable(this); }

    isBusy() { this.isLoading = true; }
    isIdle() { this.isLoading = false; }
}
```

**`activityStore.ts`** — holds the activity list filter values:

```typescript
class ActivityStore {
    filter: 'all' | 'isGoing' | 'isHost' = 'all';
    startDate = new Date().toISOString();

    constructor() { makeAutoObservable(this); }

    setFilter(filter: string) { this.filter = filter as ...; }
    setStartDate(date: string) { this.startDate = date; }
}
```

These filter values are read by `useActivities` as React Query `queryKey` parameters, so changing a filter automatically triggers a fresh query.

#### React Query

`@tanstack/react-query v5.90.21`

Handles all async server data. Key hooks:

**`useInfiniteQuery`** — powers infinite scroll on the activity feed:

```typescript
// lib/hooks/useActivities.ts
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
        queryKey: ['activities', filter, startDate],
        queryFn: ({ pageParam }) =>
            agent.Activities.list({ filter, startDate, cursor: pageParam, pageSize: 3 }),
        initialPageParam: undefined as Date | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!currentUser,
    });
```

**Optimistic updates** — `updateAttendance` updates the cache before the server responds:

```typescript
const { mutate: updateAttendance } = useMutation({
    mutationFn: (id: string) => agent.Activities.attend(id),
    onMutate: async (activityId) => {
        // Cancel any in-flight refetches
        await queryClient.cancelQueries({ queryKey: ['activities'] });
        // Snapshot current value for rollback
        const previousActivities = queryClient.getQueryData(['activities', filter, startDate]);
        // Optimistically update cached data
        queryClient.setQueryData(...)
        return { previousActivities };
    },
    onError: (_err, _vars, context) => {
        // Roll back on failure
        queryClient.setQueryData(['activities', filter, startDate], context?.previousActivities);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['activities'] })
});
```

---

### 4.3 API Communication — Axios

`axios v1.13.4`

Single Axios instance configured in `lib/api/agent.ts`:

```typescript
axios.defaults.baseURL = import.meta.env.VITE_API_URL;  // from .env files
axios.defaults.withCredentials = true;  // sends cookies with every request

// Request interceptor — start loading spinner
axios.interceptors.request.use(config => {
    store.uiStore.isBusy();
    return config;
});

// Response interceptor — stop spinner, handle errors
axios.interceptors.response.use(
    async response => {
        if (import.meta.env.DEV) await sleep(1000);  // artificial delay in dev
        store.uiStore.isIdle();
        return response;
    },
    (error: AxiosError) => {
        store.uiStore.isIdle();
        const { status, data } = error.response!;
        switch (status) {
            case 400:
                if (Array.isArray(data)) throw data;  // validation array
                break;
            case 401: break;  // React Query handles redirecting to login
            case 404: router.navigate('/not-found'); break;
            case 500: router.navigate('/server-error', { state: { error: data } }); break;
        }
        return Promise.reject(error);
    }
);
```

**Why `withCredentials: true`?** The backend uses cookie authentication (not JWT in headers). Cookies are HttpOnly and not accessible from JavaScript. `withCredentials` tells the browser to include cookies on cross-origin requests. The backend CORS policy must also `AllowCredentials()` for this to work.

**The 1-second dev delay** is intentional — it makes the loading spinner visible during development so you can test loading states.

API methods are organized by resource:

```typescript
const agent = {
    Account: {
        current: () => axios.get<User>('/account/user-info'),
        login: (values: LoginFormValues) =>
            axios.post('/login?useCookies=true', values),  // Identity endpoint
        register: (values: RegisterFormValues) =>
            axios.post<User>('/account/register', values),
        logout: () => axios.post('/account/logout'),
    },
    Activities: {
        list: (params: ActivityParams) =>
            axios.get<PagedList<Activity, Date>>('/activities', { params })
                .then(r => r.data),
        details: (id: string) => axios.get<Activity>(`/activities/${id}`).then(r => r.data),
        create: (activity: CreateActivityValues) =>
            axios.post<string>('/activities', activity).then(r => r.data),
        // ...
    },
    // ...
};
```

---

### 4.4 Forms & Validation — React Hook Form + Zod

`react-hook-form v7.71.0` + `zod v4.3.6` + `@hookform/resolvers v5.2.2`

React Hook Form manages form state with minimal re-renders. Zod provides schema-based validation. The `zodResolver` bridges them:

```typescript
// lib/schemas/activitySchema.ts
export const activitySchema = z.object({
    title: requiredString,
    description: requiredString,
    category: requiredString,
    date: z.coerce.date(),
    location: z.object({
        venue: requiredString,
        city: z.string().optional(),
        latitude: z.coerce.number(),
        longitude: z.coerce.number(),
    })
});
export type ActivityFormValues = z.infer<typeof activitySchema>;

// In ActivityForm.tsx:
const { control, handleSubmit } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { ... },
});
```

**`z.coerce.date()`** — coerces strings from `<input type="datetime-local">` into `Date` objects before validation.  
**`z.coerce.number()`** — coerces latitude/longitude strings from location input into numbers.  
**`requiredString`** helper — `z.string().min(1, 'Required')` — avoids empty-string slipping through.

Custom input components wrap Material UI fields with React Hook Form's `Controller`:

```typescript
// app/shared/components/TextInput.tsx
<Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
        <TextField
            {...field}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
        />
    )}
/>
```

---

### 4.5 Real-Time — SignalR

`@microsoft/signalr v10.0.0`

Used exclusively for activity comments. `useComments.ts` uses MobX `useLocalObservable` instead of React Query because SignalR is event-driven (push), not request-driven (poll):

```typescript
// lib/hooks/useComments.ts
const commentStore = useLocalObservable(() => ({
    comments: [] as ChatComment[],
    hub: null as HubConnection | null,

    createHubConnection(activityId: string) {
        this.hub = new HubConnectionBuilder()
            .withUrl(import.meta.env.VITE_COMMENT_URL + '?activityId=' + activityId,
                { withCredentials: true })
            .withAutomaticReconnect()
            .build();

        this.hub.on('LoadComments', (comments: ChatComment[]) => {
            runInAction(() => { this.comments = comments; });
        });

        this.hub.on('ReceiveComment', (comment: ChatComment) => {
            runInAction(() => { this.comments.push(comment); });
        });

        this.hub.start();
    },

    async addComment(activityId: string, body: string) {
        await this.hub?.invoke('SendComment', { activityId, body });
    },

    stopHubConnection() {
        this.hub?.stop();
    }
}));
```

**`.withAutomaticReconnect()`** — the client automatically tries to reconnect if the WebSocket drops.  
**`runInAction()`** — required when mutating MobX observables inside async callbacks (outside the constructor).  
**`VITE_COMMENT_URL`** — separate env var for the SignalR endpoint, distinct from REST API URL.

---

### 4.6 UI — Material UI + Leaflet + react-cropper

#### Material UI

`@mui/material v7.3.7` + `@mui/icons-material v7.3.7` + `@emotion/react` + `@emotion/styled`

MUI provides the design system. `@emotion` packages are the CSS-in-JS runtime MUI uses internally.

`@mui/x-date-pickers v7.23.6` — provides the `DateTimePicker` component used in `DateTimeInput`. Requires `date-fns` as the date adapter:

```typescript
// In DateTimeInput.tsx
<LocalizationProvider dateAdapter={AdapterDateFns}>
    <DateTimePicker ... />
</LocalizationProvider>
```

#### Leaflet

`leaflet v1.9.4` + `react-leaflet v5.0.0` + `@types/leaflet v1.9.21`

Renders an interactive map in `MapComponent.tsx`. Coordinates come from either the activity data (detail view) or the LocationIQ geocoding result (form view):

```typescript
// app/shared/components/MapComponent.tsx
<MapContainer center={[latitude, longitude]} zoom={13}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Marker position={[latitude, longitude]}>
        <Popup>{venue}</Popup>
    </Marker>
</MapContainer>
```

**Known gotcha**: Leaflet requires its CSS to be imported — `import 'leaflet/dist/leaflet.css'`. Missing this makes the map render but look broken (tiles misaligned, controls invisible).

#### LocationInput — LocationIQ Geocoding

`LocationInput.tsx` is a custom autocomplete that calls the LocationIQ API to turn a typed address into lat/lng coordinates. The results populate the hidden `latitude` and `longitude` form fields. The `LocationIQSuggestion` type in `index.d.ts` models the API response.

#### Photo Upload — react-dropzone + react-cropper

`react-dropzone v15.0.0` + `react-cropper v2.3.3`

`PhotoUploadWidget` is a multi-step upload component:
1. User drops/selects a file (`react-dropzone`)
2. User crops the image to a square (`react-cropper`, wraps Cropper.js)
3. Cropped canvas blob is sent to the server as `multipart/form-data`

```typescript
// Getting the cropped blob from Cropper.js:
cropperRef.current?.getCroppedCanvas().toBlob(blob => {
    if (blob) onUpload(blob);
});
```

#### React Infinite Scroll — react-intersection-observer

`react-intersection-observer v10.0.3`

Triggers fetching the next page when the user scrolls to the bottom of the list — no scroll event listeners:

```typescript
const { ref, inView } = useInView();

useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
}, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// Attach ref to the sentinel element at the bottom of the list
<div ref={ref} />
```

#### React Toastify

`react-toastify v11.0.5` — toast notifications for success/error feedback. Configured in `App.tsx` with `<ToastContainer />`.

#### date-fns

`date-fns v4.1.0` — date utility library used for:
- MUI DateTimePicker adapter
- `formatDate` and `timeAgo` utility functions in `lib/util/`

---

### 4.7 npm Package Reference

| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.0 | UI framework |
| `react-dom` | 19.2.0 | DOM rendering |
| `react-router` | 7.13.0 | Client-side routing |
| `typescript` | 5.8.3 | Type checking |
| `vite` | 7.2.4 | Build tool and dev server |
| `@vitejs/plugin-react` | 5.1.1 | React Fast Refresh in Vite |
| `vite-plugin-mkcert` | 1.17.9 | Auto-generates localhost HTTPS cert |
| `@tanstack/react-query` | 5.90.21 | Server state management and caching |
| `@tanstack/react-query-devtools` | 5.91.3 | Dev overlay for inspecting query cache |
| `mobx` | 6.15.0 | Reactive observable state |
| `mobx-react-lite` | 4.1.1 | MobX bindings for React (functional components) |
| `axios` | 1.13.4 | HTTP client |
| `@microsoft/signalr` | 10.0.0 | SignalR WebSocket client |
| `@mui/material` | 7.3.7 | Material Design component library |
| `@mui/icons-material` | 7.3.7 | MUI icon set |
| `@mui/x-date-pickers` | 7.23.6 | DateTimePicker component |
| `@emotion/react` | 11.14.0 | CSS-in-JS runtime (required by MUI) |
| `@emotion/styled` | 11.14.1 | Styled component API (required by MUI) |
| `@fontsource/roboto` | 5.2.9 | Self-hosted Roboto font (MUI default) |
| `react-hook-form` | 7.71.0 | Performant form state management |
| `@hookform/resolvers` | 5.2.2 | Connects Zod schema to React Hook Form |
| `zod` | 4.3.6 | Schema-based validation |
| `leaflet` | 1.9.4 | Interactive maps (OpenStreetMap tiles) |
| `react-leaflet` | 5.0.0 | React bindings for Leaflet |
| `react-dropzone` | 15.0.0 | Drag-and-drop file upload |
| `react-cropper` | 2.3.3 | Image cropping (wraps Cropper.js) |
| `react-calendar` | 6.0.0 | Calendar widget for date filtering |
| `react-intersection-observer` | 10.0.3 | Infinite scroll sentinel detection |
| `react-toastify` | 11.0.5 | Toast notification system |
| `date-fns` | 4.1.0 | Date utilities (also MUI date adapter) |
| `babel-plugin-react-compiler` | 1.0.0 | Experimental React compiler optimizations |

---

## 5. Shared Architectural Patterns

### 5.1 CQRS Pattern

**What it is**: Command Query Responsibility Segregation — operations that read data (queries) are separate from operations that change data (commands).

**Why it exists**: Avoids "God services" that mix read and write logic. Queries can be optimized differently (e.g., direct `ProjectTo` projection) from commands (which need validation, business rules).

**How this project implements it**: Every operation is a C# class implementing either `IRequest<Result<T>>` (command or query). MediatR matches each request to its handler. The handler lives in the `Application` layer — controllers are thin dispatchers.

```
HTTP Request → Controller → Mediator.Send(new SomeQuery()) → Handler → Result<T> → Controller → HTTP Response
```

### 5.2 Result Pattern

**What it is**: A generic wrapper `Result<T>` that holds either a success value or an error message + status code — instead of throwing exceptions for expected errors.

```csharp
public class Result<T>
{
    public bool IsSuccess { get; set; }
    public T? Value { get; set; }
    public string? Error { get; set; }
    public ResultCode Code { get; set; }

    public static Result<T> Success(T value) => new() { IsSuccess = true, Value = value };
    public static Result<T> Failure(string error, ResultCode code = ResultCode.BadRequest)
        => new() { IsSuccess = false, Error = error, Code = code };
}
```

**Why it exists**: `NotFound`, `Forbidden`, `BadRequest` are expected outcomes, not exceptional states. Using `Result<T>` avoids try/catch in handlers and makes the contract explicit.

**`HandleResult`** in `BaseApiController` maps `ResultCode` to HTTP status codes.

### 5.3 Cursor-Based Pagination

**What it is**: Instead of `skip/take` (offset), records after a specific cursor value are fetched. Here the cursor is the `Date` of the last activity on the previous page.

**Why it exists**: Offset-based pagination is inconsistent when new records are inserted (page 2 could repeat records from page 1). Cursor pagination is stable and efficient with the `Date` index.

**Backend implementation**:
```csharp
// GetActivityList handler:
var query = context.Activities
    .Where(a => a.Date >= request.Params.StartDate);

if (cursor.HasValue)
    query = query.Where(a => a.Date >= cursor.Value);

// Fetch one extra item to detect if more pages exist
var items = await query
    .OrderBy(a => a.Date)
    .Take(request.Params.PageSize + 1)
    .ProjectTo<ActivityDto>(...)
    .ToListAsync();

var nextCursor = items.Count > request.Params.PageSize
    ? items.Last().Date
    : (DateTime?)null;
return Result<PagedList<ActivityDto, DateTime>>.Success(
    new PagedList<ActivityDto, DateTime>(items.Take(request.Params.PageSize).ToList(), nextCursor));
```

**Frontend implementation**: `useInfiniteQuery` passes `nextCursor` as `pageParam` to the next request via `getNextPageParam`. `react-intersection-observer` calls `fetchNextPage` when the bottom sentinel enters the viewport.

### 5.4 Optimistic Updates

**What it is**: The UI is updated immediately (before the server confirms), then rolled back if the request fails.

**Why it exists**: Makes toggling attendance feel instant — no spinner or waiting for the round-trip.

**How it works** (in `useActivities.ts`):
1. `onMutate` callback runs before the mutation fires: save current cache → update cache → return snapshot
2. If mutation succeeds: `onSettled` invalidates the query to sync with server
3. If mutation fails: `onError` restores the snapshot

### 5.5 Authentication — ASP.NET Identity + Cookie Auth

**No JWT tokens**. The project uses `AddIdentityApiEndpoints<User>()` which provides Identity's built-in cookie authentication.

Login endpoint: `POST /login?useCookies=true` — note the query parameter, which is how ASP.NET Identity knows to set an HttpOnly cookie instead of returning a token.

This means:
- The browser stores the session cookie automatically
- Axios sends it via `withCredentials: true`
- The backend CORS policy must include `AllowCredentials()`
- No token storage in localStorage (more secure — no XSS token theft)

### 5.6 Authorization — Custom Policy

The `IsActivityHost` policy is checked at the authorization middleware level, before the controller action runs:

```
Request → Auth Middleware → IsHostRequirementHandler (DB query) → Controller Action (if authorized)
```

`[AllowAnonymous]` on `register` and `user-info` endpoints bypasses the global `[Authorize]` on the base controller.

---

## 6. Configuration & Infrastructure

### Environment Variables

| Variable | Dev Value | Prod Value |
|---|---|---|
| `VITE_API_URL` | `https://localhost:5001/api` | `/api` |
| `VITE_COMMENT_URL` | `https://localhost:5001/comments` | `/comments` |

In production, the React app is built into `API/wwwroot/` and served as static files from the same origin as the API — so relative paths work.

### Docker

`docker-compose.yml` runs a **SQL Server 2022** container:
- Port: `1433`
- SA password: `Password@1`
- Named volume: `sql-data` (persists DB across restarts)

Matches the connection string in `appsettings.Development.json`.

### Cloudinary

Credentials stored in `appsettings.json` (plaintext — fine for a learning project; production should use environment variables or secrets). The `CloudinarySettings` class binds to the config section via `IOptions<CloudinarySettings>`.

### Vite Build Config

```typescript
// vite.config.ts
build: {
    outDir: '../API/wwwroot',  // Build output goes into the .NET project
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
},
server: {
    port: 3000,
},
plugins: [
    mkcert(),         // Auto-generates dev HTTPS cert (needed for secure cookies)
    react({
        babel: { plugins: [['babel-plugin-react-compiler', {}]] }
    })
],
```

**Why `mkcert`?** The backend uses HTTPS on `localhost:5001`, and `withCredentials` cookies require the frontend to also be on HTTPS in development — browsers block cross-site secure cookies from HTTP origins.

---

## 7. Non-Obvious Decisions & Gotchas

### 1. DateTime UTC Conversion in DbContext
All `DateTime` values are silently converted to UTC on save and marked as `DateTimeKind.Utc` on read. This is applied globally via a value converter loop in `OnModelCreating`. Without this, SQL Server stores DateTimes without timezone info and you can get confusing behavior when comparing dates.

### 2. Cascade Delete Asymmetry in UserFollowing
`Observer → Cascade`, `Target → NoAction`. SQL Server doesn't allow two cascade paths to the same table. If you add a second `Cascade`, the migration will fail at runtime with a "multiple cascade paths" error.

### 3. AutoMapper `currentUserId` Injection
`MappingProfiles` must declare `string? currentUserId` as a class field (not a local variable) for EF Core `ProjectTo` to inject the anonymous parameter. If you refactor this incorrectly, `IsHost`/`IsGoing`/`Following` will always be `false`.

### 4. `POST /login?useCookies=true`
The `?useCookies=true` query parameter is not documented prominently. It's part of the ASP.NET Identity API endpoint behavior. Omitting it returns a token response instead of setting a cookie, which would break the auth flow here.

### 5. SignalR Cookie Auth
SignalR WebSocket connections also use the cookie (via `withCredentials`). This is configured in the `HubConnectionBuilder` with `.withCredentials: true` on the frontend. If this is missing, the hub connection will be rejected as unauthorized.

### 6. Host Cancels vs. Non-Host Leaves
`UpdateAttendance` command has two branches: if the current user is the host, it toggles `IsCancelled` on the activity. If they're a regular attendee, it removes or adds their `ActivityAttendee` record. The distinction is critical — the host cannot "leave" their own activity; they can only cancel it.

### 7. Photos — Cannot Delete Main Photo
`DeletePhoto` handler explicitly guards against deleting the photo that is currently set as the user's `ImageUrl`. The `SetMainPhoto` handler updates both the `Photo.IsMain` state and `User.ImageUrl`. The `ImageUrl` on `User` is a denormalization for display performance.

### 8. Dev Sleep in Axios Interceptor
`await sleep(1000)` in the response interceptor only runs when `import.meta.env.DEV` is `true`. Vite strips `import.meta.env.DEV` to `false` in production builds, so this dead code is excluded. Purpose: makes loading spinners visible during development.

### 9. React Compiler Plugin
`babel-plugin-react-compiler` (v1.0.0) is the experimental React 19 compiler — it automatically memoizes components and callbacks without needing `useMemo`/`useCallback`. This is pre-stable; if you see unusual memoization behavior, this plugin is the likely cause.

### 10. `FallbackController` is Needed for SPA Routing
When deployed (React built into `wwwroot`), any direct URL like `/activities/abc` would 404 from the .NET server because that path doesn't exist. `FallbackController` returns `index.html` for all non-API, non-file routes, letting React Router handle it on the client.

### 11. Cursor Pagination — Off-by-One
The backend fetches `pageSize + 1` items. If the returned list has more than `pageSize` items, there's a next page; the cursor is the last item's Date. The extra item is NOT included in the response. `hasNextPage` in React Query is `true` when `getNextPageParam` returns a non-undefined value.

### 12. `IsHost` Policy Hit on Every Edit/Delete
The `IsHostRequirementHandler` makes a database query on every PUT/DELETE activity request. This is acceptable for this app's scale but would be a consideration for high-traffic scenarios.
