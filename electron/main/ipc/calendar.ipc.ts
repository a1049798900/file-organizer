// 日历 IPC 处理器
import { ipcMain } from 'electron';
import { CH } from '../../../src/shared/ipc-contract';
import type { CalendarRange, MeetingScheduleInput, TaskScheduleInput } from '@shared/calendar';
import * as calendarSvc from '../services/calendarSvc';
import * as scheduleSvc from '../services/scheduleSvc';
import * as sampleDataSvc from '../services/sampleDataSvc';

export function registerCalendarIpc(): void {
  ipcMain.handle(CH.CALENDAR_LIST_EVENTS, (_event, range: CalendarRange) => {
    return calendarSvc.listEvents(range);
  });

  ipcMain.handle(CH.CALENDAR_GET_AREA_DETAIL, (_event, areaId: number) => {
    return calendarSvc.getAreaDetail(areaId);
  });

  ipcMain.handle(CH.CALENDAR_LIST_PROJECT_SCHEDULE, (_event, projectId: number) => {
    return scheduleSvc.listProjectSchedule(projectId);
  });

  ipcMain.handle(CH.CALENDAR_LIST_CONTACT_SCHEDULE, (_event, contactId: number) => {
    return scheduleSvc.listContactSchedule(contactId);
  });

  ipcMain.handle(CH.CALENDAR_CREATE_TASK, (_event, input: TaskScheduleInput) => {
    return scheduleSvc.createTask(input);
  });

  ipcMain.handle(
    CH.CALENDAR_UPDATE_TASK,
    (_event, args: { id: number; input: TaskScheduleInput }) => {
      scheduleSvc.updateTask(args.id, args.input);
    },
  );

  ipcMain.handle(CH.CALENDAR_DELETE_TASK, (_event, id: number) => {
    scheduleSvc.deleteTask(id);
  });

  ipcMain.handle(
    CH.CALENDAR_SET_TASK_STATUS,
    (_event, args: { id: number; status: 'done' | 'open' }) => {
      if (args.status !== 'done' && args.status !== 'open') {
        throw new Error('无效的任务状态');
      }
      scheduleSvc.setTaskStatus(args.id, args.status);
    },
  );

  ipcMain.handle(CH.CALENDAR_CREATE_MEETING, (_event, input: MeetingScheduleInput) => {
    return scheduleSvc.createMeeting(input);
  });

  ipcMain.handle(
    CH.CALENDAR_UPDATE_MEETING,
    (_event, args: { id: number; input: MeetingScheduleInput }) => {
      scheduleSvc.updateMeeting(args.id, args.input);
    },
  );

  ipcMain.handle(CH.CALENDAR_DELETE_MEETING, (_event, id: number) => {
    scheduleSvc.deleteMeeting(id);
  });

  ipcMain.handle(CH.CALENDAR_SEED_SAMPLE, () => {
    return sampleDataSvc.seedSampleData();
  });

  ipcMain.handle(CH.CALENDAR_CLEAR_SAMPLE, () => {
    sampleDataSvc.clearSampleData();
  });
}
