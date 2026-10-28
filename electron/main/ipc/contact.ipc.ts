// 通讯录 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import * as contactSvc from '../services/contactSvc';
import type { ContactInput } from '@shared/types';

export function registerContactIpc(): void {
  ipcMain.handle(CH.CONTACT_LIST, (_event, query: string | undefined) => {
    return contactSvc.listContacts(query ?? '');
  });

  ipcMain.handle(CH.CONTACT_DETAIL, (_event, id: number) => {
    return contactSvc.getContactDetail(id);
  });

  ipcMain.handle(CH.CONTACT_CREATE, (_event, input: ContactInput) => {
    return contactSvc.createContact(input);
  });

  ipcMain.handle(CH.CONTACT_UPDATE, (_event, args: { id: number; input: ContactInput }) => {
    return contactSvc.updateContact(args.id, args.input);
  });

  ipcMain.handle(CH.CONTACT_DELETE, (_event, id: number) => {
    contactSvc.deleteContact(id);
  });

  ipcMain.handle(CH.CONTACT_LIST_BY_FILE, (_event, fileId: number) => {
    return contactSvc.listContactsByFile(fileId);
  });

  ipcMain.handle(
    CH.CONTACT_SET_FILE_CONTACTS,
    (_event, args: { fileId: number; contactIds: number[] }) => {
      contactSvc.setFileContacts(args.fileId, args.contactIds);
    },
  );

  ipcMain.handle(CH.CONTACT_LIST_BY_PROJECT, (_event, projectId: number) => {
    return contactSvc.listContactsByProject(projectId);
  });

  ipcMain.handle(
    CH.CONTACT_SET_PROJECT_CONTACTS,
    (_event, args: { projectId: number; contactIds: number[] }) => {
      contactSvc.setProjectContacts(args.projectId, args.contactIds);
    },
  );

  ipcMain.handle(
    CH.CONTACT_SET_CONTACT_FILES,
    (_event, args: { contactId: number; fileIds: number[] }) => {
      contactSvc.setContactFiles(args.contactId, args.fileIds);
    },
  );

  ipcMain.handle(
    CH.CONTACT_SET_CONTACT_PROJECTS,
    (_event, args: { contactId: number; projectIds: number[] }) => {
      contactSvc.setContactProjects(args.contactId, args.projectIds);
    },
  );

  ipcMain.handle(
    CH.CONTACT_ADD_TO_FILES,
    (_event, args: { fileIds: number[]; contactIds: number[] }) => {
      return contactSvc.addContactsToFiles(args.fileIds, args.contactIds);
    },
  );

  ipcMain.handle(
    CH.CONTACT_ADD_TO_PROJECTS,
    (_event, args: { projectIds: number[]; contactIds: number[] }) => {
      return contactSvc.addContactsToProjects(args.projectIds, args.contactIds);
    },
  );

  ipcMain.handle(CH.CONTACT_DELETE_MANY, (_event, ids: number[]) => {
    return contactSvc.deleteContacts(ids);
  });
}
