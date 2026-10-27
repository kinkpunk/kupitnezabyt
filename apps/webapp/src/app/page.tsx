"use client";

import { ErrorNotice } from "../components/ui/ErrorNotice";
import { ToastNotice } from "../components/ui/ToastNotice";
import { LoginScreen } from "../components/features/LoginScreen";
import { LegalConsentModal } from "../components/features/LegalConsentModal";
import { OnboardingModal } from "../components/features/OnboardingModal";
import { AppHeader, AppLoadingSkeleton, OfflineBanner } from "../components/common";
import { BottomNav } from "../components/BottomNav";
import { MenuSheet } from "../components/MenuSheet";
import { NotificationSheet } from "../components/NotificationSheet";
import { HomeView } from "../components/views/HomeView";
import { CategoriesView } from "../components/views/CategoriesView";
import { ShoppingView } from "../components/views/ShoppingView";
import { CheckView } from "../components/views/CheckView";
import { SearchView } from "../components/views/SearchView";
import { ArchiveView } from "../components/views/ArchiveView";
import { SettingsView } from "../components/views/SettingsView";
import { useAppState } from "../hooks/useAppState";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { starterCategories, starterItemHints } from "../lib/ui";

export default function Home() {
  const state = useAppState();
  const isOnline = useOnlineStatus();

  if (state.isLoading) {
    return <AppLoadingSkeleton message={state.loadingMessage} />;
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
        showLegalConsent={state.showLegalConsent}
        termsAccepted={state.termsAccepted}
        privacyAccepted={state.privacyAccepted}
        onTermsAcceptedChange={state.setTermsAccepted}
        onPrivacyAcceptedChange={state.setPrivacyAccepted}
        telegramAvailable={state.telegramAvailable}
        isContinuingWithTelegram={state.isContinuingWithTelegram}
        onContinueWithTelegram={state.handleContinueWithTelegram}
        onStartGoogleSignIn={state.handleStartGoogleSignIn}
        onStartAppleSignIn={state.handleStartAppleSignIn}
        onRequestMagicLink={state.handleRequestMagicLink}
      />
    );
  }

  if (state.consentRecorded === false) {
    return (
      <LegalConsentModal isSaving={state.isSavingConsent} onAccept={state.handleAcceptLegalConsent} />
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
        onAdvanceToStarterItems={state.handleAdvanceToStarterItems}
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
            needBuyItems={state.needBuyItems}
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
            categorySortMode={state.categorySortMode}
            visibleItems={state.visibleItems}
            visibleRecommendations={state.visibleRecommendations}
            recommendationSourceItemName={state.recommendationSourceItemName}
            canWriteActiveWorkspace={state.canWriteActiveWorkspace}
            searchQuery={state.searchQuery}
            onSearchQueryChange={state.setSearchQuery}
            onSearch={state.handleSearchItems}
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
            onSaveReminderSetting={state.handleSaveReminderSetting}
            savingReminderKeys={state.savingReminderKeys}
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
            showShoppingForm={state.showShoppingForm}
            setShowShoppingForm={state.setShowShoppingForm}
            editingShoppingId={state.editingShoppingId}
            setEditingShoppingId={state.setEditingShoppingId}
            editingShoppingTitle={state.editingShoppingTitle}
            setEditingShoppingTitle={state.setEditingShoppingTitle}
            onCreateManualShoppingItem={state.handleCreateManualShoppingItem}
            onUpdateManualShoppingItem={state.handleUpdateManualShoppingItem}
            onDeleteManualShoppingItem={state.handleDeleteManualShoppingItem}
            onCompleteShoppingListItem={state.handleCompleteShoppingListItem}
            onEditItemEntry={state.handleEditShoppingEntryItem}
            onArchiveItem={state.handleArchiveItem}
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
            onSearchQueryChange={state.setSearchQuery}
            onSearch={state.handleSearchItems}
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
            theme={state.theme}
            onThemeChange={state.setTheme}
            onCreateWorkspaceInvitation={state.handleCreateWorkspaceInvitation}
            onRevokeWorkspaceInvitation={state.handleRevokeWorkspaceInvitation}
            onRemoveWorkspaceMember={state.handleRemoveWorkspaceMember}
            onTransferWorkspaceOwnership={state.handleTransferWorkspaceOwnership}
            onRetryWorkspaceLoad={state.handleRetryWorkspaceLoad}
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

  const screenTitles: Partial<Record<typeof state.activeTab, string>> = {
    home: "Главная",
    items: "Категории",
    shopping: "Покупки",
    check: "Проверка",
    archive: "Архив",
    settings: "Настройки"
  };

  return (
    <main className="app-shell">
      <AppHeader
        menuOpen={state.showMenuSheet}
        menuActive={
          state.showMenuSheet ||
          state.activeTab === "settings" ||
          state.activeTab === "archive"
        }
        title={screenTitles[state.activeTab]}
        onMenuClick={() => state.setShowMenuSheet((current) => !current)}
      />
      {isOnline ? null : <OfflineBanner />}
      <ErrorNotice message={state.error} onClose={() => state.setError(null)} />
      <ToastNotice
        message={state.toastMessage}
        actionLabel={state.toastAction?.label}
        onAction={state.toastAction?.run}
        onClose={state.dismissToast}
      />

      <div className="main-content">{renderActiveView()}</div>

      <BottomNav activeTab={state.activeTab} onSelectTab={state.handleSelectTab} />

      <MenuSheet
        show={state.showMenuSheet}
        activeWorkspace={state.activeWorkspace}
        workspaces={state.workspaces}
        showWorkspaceSwitcher={state.showWorkspaceSwitcher}
        activeTab={state.activeTab}
        onClose={() => state.setShowMenuSheet(false)}
        onSelectTab={state.handleSelectMenuTab}
        onOpenActivity={state.handleOpenActivity}
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
