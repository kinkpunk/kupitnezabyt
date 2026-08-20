"use client";

import { ErrorNotice } from "../components/ui/ErrorNotice";
import { ToastNotice } from "../components/ui/ToastNotice";
import { LoginScreen } from "../components/features/LoginScreen";
import { OnboardingModal } from "../components/features/OnboardingModal";
import { TopBar } from "../components/TopBar";
import { BottomNav } from "../components/BottomNav";
import { MenuSheet } from "../components/MenuSheet";
import { NotificationSheet } from "../components/NotificationSheet";
import { HomeView } from "../components/views/HomeView";
import { CategoriesView } from "../components/views/CategoriesView";
import { ShoppingView } from "../components/views/ShoppingView";
import { GroupsView } from "../components/views/GroupsView";
import { CheckView } from "../components/views/CheckView";
import { SearchView } from "../components/views/SearchView";
import { ArchiveView } from "../components/views/ArchiveView";
import { SettingsView } from "../components/views/SettingsView";
import { useAppState } from "../hooks/useAppState";
import { starterCategories, starterItemHints } from "../lib/ui";

export default function Home() {
  const state = useAppState();

  if (state.isLoading) {
    return (
      <main className="app-shell loading-shell">
        <p>{state.loadingMessage}</p>
      </main>
    );
  }

  if (!state.token) {
    return (
      <LoginScreen
        error={state.error}
        onCloseError={() => state.setError(null)}
        authProviders={state.authProviders}
        isStartingGoogleSignIn={state.isStartingGoogleSignIn}
        isStartingAppleSignIn={state.isStartingAppleSignIn}
        isRequestingMagicLink={state.isRequestingMagicLink}
        email={state.email}
        onEmailChange={state.setEmail}
        emailAuthMessage={state.emailAuthMessage}
        devMagicLink={state.devMagicLink}
        onStartGoogleSignIn={state.handleStartGoogleSignIn}
        onStartAppleSignIn={state.handleStartAppleSignIn}
        onRequestMagicLink={state.handleRequestMagicLink}
      />
    );
  }

  if (state.showOnboarding) {
    return (
      <OnboardingModal
        error={state.error}
        onCloseError={() => state.setError(null)}
        onboardingStep={state.onboardingStep}
        setOnboardingStep={state.setOnboardingStep}
        selectedStarterCategories={state.selectedStarterCategories}
        setSelectedStarterCategories={state.setSelectedStarterCategories}
        starterItems={state.starterItems}
        setStarterItems={state.setStarterItems}
        starterCategories={starterCategories}
        starterItemHints={starterItemHints}
        starterCategoryOptions={state.starterCategoryOptions}
        onFinish={state.handleFinishOnboarding}
      />
    );
  }

  function handleOpenShoppingEntry(entry: import("../lib/types").ShoppingListEntry) {
    if (entry.item) {
      state.handleSelectCategory(entry.item.categoryId);
    } else {
      state.handleSelectTab("shopping");
    }
  }

  function renderActiveView() {
    switch (state.activeTab) {
      case "home":
        return (
          <HomeView
            items={state.items}
            categories={state.categories}
            shoppingList={state.shoppingList}
            inAppReminders={state.inAppReminders}
            checkSession={state.checkSession}
            urgentItems={state.urgentItems}
            attentionItemsCount={state.attentionItemsCount}
            itemReminders={state.itemReminders}
            categoryReminders={state.categoryReminders}
            groupReminders={state.groupReminders}
            onSelectTab={state.handleSelectTab}
            onSelectCategory={state.handleSelectCategory}
            onSetStatus={state.handleSetStatus}
            onStartReminderCheck={state.handleStartReminderCheck}
            onSnoozeReminder={state.handleSnoozeReminder}
            onOpenReminder={state.handleOpenReminder}
            isActionPending={state.isActionPending}
          />
        );
      case "items":
        return (
          <CategoriesView
            categories={state.categories}
            selectedCategory={state.selectedCategory}
            categoryName={state.categoryName}
            setCategoryName={state.setCategoryName}
            showCategoryForm={state.showCategoryForm}
            setShowCategoryForm={state.setShowCategoryForm}
            itemName={state.itemName}
            setItemName={state.setItemName}
            showItemForm={state.showItemForm}
            setShowItemForm={state.setShowItemForm}
            editingItemId={state.editingItemId}
            setEditingItemId={state.setEditingItemId}
            editingItemName={state.editingItemName}
            setEditingItemName={state.setEditingItemName}
            editingItemImportance={state.editingItemImportance}
            setEditingItemImportance={state.setEditingItemImportance}
            categorySortMode={state.categorySortMode}
            visibleItems={state.visibleItems}
            visibleRecommendations={state.visibleRecommendations}
            recommendationSourceItemName={state.recommendationSourceItemName}
            canWriteActiveWorkspace={state.canWriteActiveWorkspace}
            showShareEntryPoint={state.showShareEntryPoint}
            searchQuery={state.searchQuery}
            onSearchQueryChange={state.setSearchQuery}
            onSearch={state.handleSearchItems}
            notificationCount={state.notificationCount}
            onBellClick={state.handleBellClick}
            onSelectSettings={() => state.handleSelectTab("settings")}
            onSelectCategory={(categoryId) => {
              state.clearSearchSession();
              state.setSelectedCategoryId(categoryId);
              state.setShowCategoryForm(false);
            }}
            onCreateCategory={state.handleCreateCategory}
            onCreateItem={state.handleCreateItem}
            onSetStatus={state.handleSetStatus}
            onCategorySortModeChange={state.handleCategorySortModeChange}
            onMoveItem={state.handleMoveItem}
            onAcceptRecommendation={state.handleAcceptRecommendation}
            onDismissRecommendation={state.handleDismissRecommendation}
            onHideSimilarRecommendations={state.handleHideSimilarRecommendations}
            onUpdateItem={state.handleUpdateItem}
            onArchiveItem={state.handleArchiveItem}
            onArchiveSelectedCategory={state.handleArchiveSelectedCategory}
            onStartCategoryCheck={state.handleStartCategoryCheck}
            setError={state.setError}
            isActionPending={state.isActionPending}
          />
        );
      case "shopping":
        return (
          <ShoppingView
            shoppingList={state.shoppingList}
            shoppingGroups={state.shoppingGroups}
            categories={state.categories}
            manualShoppingTitle={state.manualShoppingTitle}
            setManualShoppingTitle={state.setManualShoppingTitle}
            manualShoppingCategoryId={state.manualShoppingCategoryId}
            setManualShoppingCategoryId={state.setManualShoppingCategoryId}
            manualShoppingPriority={state.manualShoppingPriority}
            setManualShoppingPriority={state.setManualShoppingPriority}
            editingShoppingId={state.editingShoppingId}
            setEditingShoppingId={state.setEditingShoppingId}
            editingShoppingTitle={state.editingShoppingTitle}
            setEditingShoppingTitle={state.setEditingShoppingTitle}
            onCreateManualShoppingItem={state.handleCreateManualShoppingItem}
            onUpdateManualShoppingItem={state.handleUpdateManualShoppingItem}
            onDeleteManualShoppingItem={state.handleDeleteManualShoppingItem}
            onCompleteShoppingListItem={state.handleCompleteShoppingListItem}
            onClearCompletedShoppingList={state.handleClearCompletedShoppingList}
            setError={state.setError}
            isActionPending={state.isActionPending}
          />
        );
      case "groups":
        return (
          <GroupsView
            groups={state.groups}
            selectedGroup={state.selectedGroup}
            groupName={state.groupName}
            setGroupName={state.setGroupName}
            groupItemId={state.groupItemId}
            setGroupItemId={state.setGroupItemId}
            items={state.items}
            selectedGroupCheckItemCount={state.selectedGroupCheckItemCount}
            onCreateGroup={state.handleCreateGroup}
            onArchiveSelectedGroup={state.handleArchiveSelectedGroup}
            onAddGroupItem={state.handleAddGroupItem}
            onRemoveGroupItem={state.handleRemoveGroupItem}
            onStartGroupCheck={state.handleStartGroupCheck}
            onSelectGroup={state.setSelectedGroupId}
            setError={state.setError}
            isActionPending={state.isActionPending}
          />
        );
      case "check":
        return (
          <CheckView
            checkSession={state.checkSession}
            checkedCount={state.checkedCount}
            currentCheckItem={state.currentCheckItem}
            pendingCheckItemName={state.pendingCheckItemName}
            selectedCategory={state.selectedCategory}
            categories={state.categories}
            onCancelCheck={state.handleCancelCheck}
            onStartCategoryCheck={state.handleStartCategoryCheck}
            onCheckStatus={state.handleCheckStatus}
            onClearSearchSession={state.clearSearchSession}
            onSelectCategory={(categoryId) => {
              state.clearSearchSession();
              state.setSelectedCategoryId(categoryId);
            }}
            setError={state.setError}
          />
        );
      case "search":
        return (
          <SearchView
            searchQuery={state.searchQuery}
            hasSearched={state.hasSearched}
            searchResults={state.searchResults}
            onClearSearchSession={state.clearSearchSession}
            onSelectCategory={state.setSelectedCategoryId}
            onSelectItemsTab={() => state.handleSelectTab("items")}
          />
        );
      case "archive":
        return (
          <ArchiveView
            archivedCategories={state.archivedCategories}
            archivedStandaloneItems={state.archivedStandaloneItems}
            onRestoreCategory={state.handleRestoreCategory}
            onDeleteArchivedCategory={state.handleDeleteArchivedCategory}
            onRestoreItem={state.handleRestoreItem}
            onDeleteArchivedItem={state.handleDeleteArchivedItem}
            setError={state.setError}
          />
        );
      case "settings":
        return (
          <SettingsView
            activeWorkspace={state.activeWorkspace}
            canManageActiveWorkspace={state.canManageActiveWorkspace}
            workspaceMessage={state.workspaceMessage}
            workspaceInviteEmail={state.workspaceInviteEmail}
            setWorkspaceInviteEmail={state.setWorkspaceInviteEmail}
            workspaceAction={state.workspaceAction}
            devInvitationLink={state.devInvitationLink}
            isLoadingWorkspaceAccess={state.isLoadingWorkspaceAccess}
            workspaceLoadFailed={state.workspaceLoadFailed}
            workspaceMembers={state.workspaceMembers}
            workspaceInvitations={state.workspaceInvitations}
            categories={state.categories}
            groups={state.groups}
            items={state.items}
            reminderSettingsMessage={state.reminderSettingsMessage}
            savingReminderKeys={state.savingReminderKeys}
            reminderDrafts={state.reminderDrafts}
            onCreateWorkspaceInvitation={state.handleCreateWorkspaceInvitation}
            onRevokeWorkspaceInvitation={state.handleRevokeWorkspaceInvitation}
            onRemoveWorkspaceMember={state.handleRemoveWorkspaceMember}
            onTransferWorkspaceOwnership={state.handleTransferWorkspaceOwnership}
            onRetryWorkspaceLoad={state.handleRetryWorkspaceLoad}
            onSaveReminderSettingsGroup={state.handleSaveReminderSettingsGroup}
            onUpdateReminderDraft={state.updateReminderDraft}
            onExportUserData={state.handleExportUserData}
            onDeleteAccount={state.handleDeleteAccount}
            onSignOut={state.handleSignOut}
            setError={state.setError}
          />
        );
      default:
        return null;
    }
  }

  return (
    <main className="app-shell">
      {state.activeTab !== "items" ? (
        <TopBar
          searchQuery={state.searchQuery}
          onSearchQueryChange={state.setSearchQuery}
          onSearch={state.handleSearchItems}
          theme={state.theme}
          themeButtonLabel={state.themeButtonLabel}
          onToggleTheme={state.toggleTheme}
          notificationCount={state.notificationCount}
          notificationsViewed={state.notificationsViewed}
          onBellClick={state.handleBellClick}
        />
      ) : null}
      <ErrorNotice message={state.error} onClose={() => state.setError(null)} />
      <ToastNotice message={state.toastMessage} onClose={() => state.setToastMessage(null)} />

      <div className="main-content">{renderActiveView()}</div>

      <BottomNav
        activeTab={state.activeTab}
        showMenuSheet={state.showMenuSheet}
        onSelectTab={state.handleSelectTab}
        onToggleMenu={() => state.setShowMenuSheet((current) => !current)}
      />

      <MenuSheet
        show={state.showMenuSheet}
        activeWorkspace={state.activeWorkspace}
        workspaces={state.workspaces}
        showWorkspaceSwitcher={state.showWorkspaceSwitcher}
        activeTab={state.activeTab}
        onClose={() => state.setShowMenuSheet(false)}
        onSelectTab={state.handleSelectMenuTab}
        onSelectWorkspace={state.handleSelectWorkspace}
      />

      <NotificationSheet
        show={state.showNotifications}
        shoppingList={state.shoppingList}
        inAppReminders={state.inAppReminders}
        onClose={() => state.setShowNotifications(false)}
        onOpenShoppingEntry={handleOpenShoppingEntry}
        onOpenReminder={state.handleOpenReminder}
      />
    </main>
  );
}
