<script setup lang="ts">
import { useBuildingStore } from '@/stores/buildingStore'

const buildingStore = useBuildingStore()

function resetData() {
  if (confirm('Opravdu obnovit demo data? Všechny změny budou ztraceny.')) {
    buildingStore.resetToDemo()
    location.reload()
  }
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-title">Admin</h1>
        <span class="building-name">{{ buildingStore.building.name }}</span>
      </div>
      <nav class="sidebar-nav">
        <router-link :to="{ name: 'admin-units' }" class="nav-link">
          <span class="nav-icon">&#9634;</span>
          Jednotky
        </router-link>
        <router-link :to="{ name: 'admin-floorplans' }" class="nav-link">
          <span class="nav-icon">&#9638;</span>
          Půdorysy
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="nav-link reset-link" @click="resetData">
          <span class="nav-icon">&#8635;</span>
          Reset na demo data
        </button>
        <router-link :to="{ name: 'editor' }" class="nav-link back-link">
          <span class="nav-icon">&larr;</span>
          Zpět do editoru
        </router-link>
      </div>
    </aside>
    <main class="admin-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  background: var(--bg-secondary, #161616);
}

.admin-sidebar {
  width: 220px;
  background: var(--bg-primary, #1e1e1e);
  border-right: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin: 0;
}

.building-name {
  font-size: 12px;
  color: var(--text-muted, #999);
  margin-top: 4px;
  display: block;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--text-secondary, #ccc);
  text-decoration: none;
  font-size: 13px;
  transition: all 0.15s;
}

.nav-link:hover {
  background: var(--btn-hover, #333);
}

.nav-link.router-link-active {
  background: var(--accent, #2196F3);
  color: white;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--border-color, #333);
}

.reset-link {
  color: var(--text-muted, #777) !important;
  font-size: 11px;
  background: none;
  border: none;
  width: 100%;
  cursor: pointer;
}

.reset-link:hover {
  color: #ef4444 !important;
}

.back-link {
  color: var(--text-muted, #999) !important;
  font-size: 12px;
}

.back-link:hover {
  color: var(--text-primary, #eee) !important;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}
</style>
