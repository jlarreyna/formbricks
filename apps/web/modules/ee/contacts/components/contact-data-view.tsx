"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DateRange } from "react-day-picker";
import toast from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getContactsAction } from "../actions";
import { TContactTableData, TContactWithAttributes } from "../types/contact";
import { ContactsTable } from "./contacts-table";

interface ContactDataViewProps {
  workspaceId: string;
  contactAttributeKeys: TContactAttributeKey[];
  initialContacts: TContactWithAttributes[];
  initialTotal: number;
  initialPage: number;
  initialPageCount: number;
  itemsPerPage: number;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
}

const toStartOfDayIso = (date: Date): string => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.toISOString();
};

const toEndOfDayIso = (date: Date): string => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.toISOString();
};

export const ContactDataView = ({
  workspaceId,
  itemsPerPage,
  contactAttributeKeys,
  isReadOnly,
  initialContacts,
  initialTotal,
  initialPage,
  initialPageCount,
  isQuotasAllowed,
}: ContactDataViewProps) => {
  const [contacts, setContacts] = useState<TContactWithAttributes[]>([...initialContacts]);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(initialPageCount);

  const [searchValue, setSearchValue] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedSearchValue, setAppliedSearchValue] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>();

  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);
  const prevWorkspaceId = useRef(workspaceId);
  const prevInitialContactsLength = useRef(initialContacts.length);

  // Sync state with server data only when workspace changes (real tab navigation)
  useEffect(() => {
    if (prevWorkspaceId.current !== workspaceId) {
      prevWorkspaceId.current = workspaceId;
      setContacts([...initialContacts]);
      setTotal(initialTotal);
      setPage(initialPage);
      setPageCount(initialPageCount);
      setSearchValue("");
      setDateRange(undefined);
      setAppliedSearchValue("");
      setAppliedDateRange(undefined);
      prevInitialContactsLength.current = initialContacts.length;
    }
  }, [workspaceId, initialContacts, initialTotal, initialPage, initialPageCount]);

  // Sync state when initialContacts changes from server refresh (e.g., after CSV upload)
  // Only update if we're viewing the first page without filters
  useEffect(() => {
    if (
      !appliedSearchValue &&
      !appliedDateRange?.from &&
      page === 1 &&
      initialContacts.length !== prevInitialContactsLength.current &&
      prevWorkspaceId.current === workspaceId
    ) {
      setContacts([...initialContacts]);
      setTotal(initialTotal);
      setPage(initialPage);
      setPageCount(initialPageCount);
      prevInitialContactsLength.current = initialContacts.length;
    }
  }, [
    initialContacts,
    initialTotal,
    initialPage,
    initialPageCount,
    appliedSearchValue,
    appliedDateRange,
    page,
    workspaceId,
  ]);

  const environmentAttributes = useMemo(() => {
    return contactAttributeKeys.filter(
      (attr) => !["userId", "email", "firstName", "lastName"].includes(attr.key)
    );
  }, [contactAttributeKeys]);

  const loadPage = useCallback(
    (pageNumber: number) => {
      startTransition(async () => {
        try {
          const contactsResponse = await getContactsAction({
            workspaceId,
            page: pageNumber,
            limit: itemsPerPage,
            searchValue: appliedSearchValue.trim() || undefined,
            from: appliedDateRange?.from ? toStartOfDayIso(appliedDateRange.from) : undefined,
            to: appliedDateRange?.to
              ? toEndOfDayIso(appliedDateRange.to)
              : appliedDateRange?.from
                ? toEndOfDayIso(appliedDateRange.from)
                : undefined,
          });

          const payload = contactsResponse?.data;
          if (!payload) {
            toast.error("Error fetching contacts. Please try again.");
            return;
          }

          setContacts(payload.data);
          setTotal(payload.total);
          setPage(payload.page);
          setPageCount(payload.pageCount);
        } catch (error) {
          console.error("Error fetching contacts:", error);
          toast.error("Error fetching contacts. Please try again.");
        }
      });
    },
    [workspaceId, itemsPerPage, appliedSearchValue, appliedDateRange]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when applied filters change
  }, [appliedSearchValue, appliedDateRange, workspaceId]);

  const hasUnappliedChanges =
    searchValue !== appliedSearchValue ||
    dateRange?.from?.getTime() !== appliedDateRange?.from?.getTime() ||
    dateRange?.to?.getTime() !== appliedDateRange?.to?.getTime();

  const applyFilters = () => {
    setPage(1);
    setAppliedSearchValue(searchValue);
    setAppliedDateRange(dateRange);
  };

  const clearFilters = () => {
    setPage(1);
    setSearchValue("");
    setDateRange(undefined);
    setAppliedSearchValue("");
    setAppliedDateRange(undefined);
  };

  const goToPreviousPage = () => {
    if (page > 1) {
      loadPage(page - 1);
    }
  };

  const goToNextPage = () => {
    if (page < pageCount) {
      loadPage(page + 1);
    }
  };

  const refreshContacts = async () => {
    loadPage(page);
  };

  // Delete selected contacts — refresh current page so totals stay accurate
  const updateContactList = (contactIds: string[]) => {
    setContacts((prevContacts) => prevContacts.filter((contact) => !contactIds.includes(contact.id)));
    setTotal((prev) => Math.max(0, prev - contactIds.length));
    void refreshContacts();
  };

  const contactsTableData: TContactTableData[] = useMemo(() => {
    return contacts.map((contact) => ({
      id: contact.id,
      userId: contact.attributes.userId ?? "",
      email: contact.attributes.email ?? "",
      firstName: contact.attributes.firstName ?? "",
      lastName: contact.attributes.lastName ?? "",
      attributes: (environmentAttributes ?? []).map((attr) => ({
        key: attr.key,
        name: attr.name,
        value: contact.attributes[attr.key] ?? "",
        dataType: attr.dataType,
      })),
    }));
  }, [contacts, environmentAttributes]);

  return (
    <ContactsTable
      data={contactsTableData}
      isDataLoaded={true}
      isPending={isPending}
      updateContactList={updateContactList}
      workspaceId={workspaceId}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      dateRange={dateRange}
      setDateRange={setDateRange}
      hasUnappliedChanges={hasUnappliedChanges}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      page={page}
      pageCount={pageCount}
      total={total}
      itemsPerPage={itemsPerPage}
      onPreviousPage={goToPreviousPage}
      onNextPage={goToNextPage}
      isReadOnly={isReadOnly}
      isQuotasAllowed={isQuotasAllowed}
      refreshContacts={refreshContacts}
    />
  );
};
