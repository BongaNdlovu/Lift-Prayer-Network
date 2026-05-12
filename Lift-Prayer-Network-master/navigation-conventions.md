# Navigation Conventions

This document outlines the navigation patterns and conventions used in the Lift Prayer Network app.

## Navigation Structure

### Root Stack Navigator
The app uses a root stack navigator that handles authentication flow and main app navigation.

**Auth Flow:**
- `SignIn` - Sign in screen
- `SignUp` - Sign up screen
- `ForgotPassword` - Password reset screen

**Main App Flow:**
- `MainTabs` - Bottom tab navigator (Home, Prayers, Calendar, Community, Profile)
- Various detail screens nested under MainTabs

### Tab Navigator
The main tab navigator contains:
- `Home` - Feed screen with prayer requests and testimonies
- `Prayers` - My prayers screen
- `Calendar` - Calendar screen for prayer scheduling
- `Community` - Groups screen
- `Profile` - User profile screen

## Navigation Patterns

### Screen Headers
- Most screens use custom headers via `LiftHeader` component
- Some screens have native navigation headers disabled (`headerShown: false`)
- Groups stack route header is set to false for custom header implementation

### Modal Screens
Modal screens (like the reminder edit modal) should be siblings to the main screen component, not nested inside `LiftScreen`. Use React Fragment to wrap the main screen and modal together.

**Example:**
```typescript
return (
  <>
    <LiftScreen>
      <LiftHeader title="Screen Title" />
      {/* Screen content */}
    </LiftScreen>
    <Modal visible={showModal}>
      {/* Modal content */}
    </Modal>
  </>
);
```

### Navigation Params
Route parameters are defined in `src/navigation/types.ts` with proper TypeScript types.

**Key Types:**
- `RootStackParamList` - Root navigator route params
- `MainTabParamList` - Tab navigator route params

**Important Route Params:**
- `RequestDetail` - `{ id: string; type: 'REQUEST' | 'TESTIMONY'; item?: FeedItem }`
- `EditRequest` - `{ id: string; type: 'REQUEST' | 'TESTIMONY'; item: FeedItem }`
- `GroupDetail` - `{ groupId: string; groupName: string; groupEmoji?: string }`

### Navigation Best Practices

1. **Type Safety:** Always use typed navigation params from `navigation/types.ts`
2. **FeedItem Type:** Use the `FeedItem` type for request/testimony route params instead of `any`
3. **Back Navigation:** Use `navigation.goBack()` for back navigation
4. **Conditional Navigation:** Check authentication state before navigating to protected screens

### Screen Naming Conventions

- Screen components: `ScreenNameScreen` (e.g., `FeedScreen`, `ProfileScreen`)
- Route names: PascalCase matching screen name (e.g., `Feed`, `Profile`)
- Admin screens: Prefixed with `Admin` (e.g., `AdminDashboard`, `AdminReports`)

### Lazy Loading
Admin screens use lazy loading for performance:
```typescript
<Stack.Screen name="AdminDashboard">
  {(props) => (
    <LazyScreen
      factory={() =>
        import('../screens/admin/AdminDashboardScreen').then((m) => ({
          default: m.AdminDashboardScreen,
        }))
      }
      componentProps={props}
    />
  )}
</Stack.Screen>
```

## Navigation Components

### LiftLayout Components
- `LiftScreen` - Main screen wrapper with theme support
- `LiftHeader` - Custom header component
- `LiftIconButton` - Themed icon button for navigation actions

### Navigation Hooks
- `useNavigation` - Get navigation prop
- `useRoute` - Get route props
- `useAuth` - Get authentication state

## File Organization

Navigation-related files:
- `src/navigation/AppNavigator.tsx` - Main navigator configuration
- `src/navigation/types.ts` - TypeScript type definitions for navigation
- `src/screens/` - Screen components organized by feature
  - `auth/` - Authentication screens
  - `admin/` - Admin screens
  - `home/` - Home tab screens
