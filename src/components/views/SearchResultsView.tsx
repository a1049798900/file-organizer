import { useEffect, useMemo, useState } from 'react';
import { FileList } from '../filelist/FileList';
import { useFileList } from '@/hooks/useFileList';
import { useUiStore } from '@/stores/useUiStore';
import { EmptyState } from '../ui/EmptyState';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { contactApi } from '@/lib/ipc';
import type { ContactRow, FileSortKey } from '@shared/types';

export function SearchResultsView() {
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setSelectedContactId = useUiStore((s) => s.setSelectedContactId);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const source = useMemo(
    () => ({ kind: 'search' as const, query: searchQuery }),
    [searchQuery],
  );

  const { rows, loading, error, refresh, sort, sortActive, setSortKey } = useFileList({
    listKey: 'search',
    source,
    enabled: !!searchQuery.trim(),
  });

  // 全局搜索联系人：只查联系人元数据，不读文件内容
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    contactApi
      .list(query)
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const handleSortChange = (key: FileSortKey) => {
    setSortKey(key);
  };

  const openContact = (contactId: number) => {
    // 清空搜索并离开搜索视图，再跳转通讯录选中联系人
    setSearchQuery('');
    setSelectedContactId(contactId);
    setActiveView('contacts');
  };

  if (!searchQuery.trim()) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="h-14 flex items-center px-4 border-b border-line flex-shrink-0">
        <div className="text-xl font-semibold text-ink">
          搜索结果 ({rows.length} 文件 · {contacts.length} 联系人)
          <span className="text-base font-normal text-ink-3 ml-2">"{searchQuery}"</span>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="border-b border-line shrink-0">
          <div className="px-4 py-1.5 text-sm text-ink-2 bg-bg-panel/60">联系人</div>
          <div className="max-h-[168px] overflow-auto">
            {contacts.map((contact) => {
              const secondary = [contact.org, contact.department, contact.title]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => openContact(contact.id)}
                  className="w-full flex items-center gap-2 px-4 h-10 text-left border-b border-line/40 hover:bg-bg-hover last:border-b-0"
                >
                  <span className="text-base">👤</span>
                  <span className="text-base text-ink">{contact.name}</span>
                  {secondary && (
                    <span className="text-sm text-ink-3 truncate">{secondary}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ErrorBoundary
        key={searchQuery}
        fallback={
          <div className="flex-1 min-h-0 overflow-auto">
            <EmptyState text="搜索失败，请重试" icon="search" />
          </div>
        }
      >
        <FileList
          listKey="search"
          rows={rows}
          loading={loading}
          sort={sort}
          sortActive={sortActive}
          onSortChange={handleSortChange}
          showSourceBadge
          scene="search"
          emptyText={error ? '搜索失败，请重试' : '没有找到匹配的文件'}
          emptyIcon="search"
          onRefresh={refresh}
        />
      </ErrorBoundary>
    </div>
  );
}
