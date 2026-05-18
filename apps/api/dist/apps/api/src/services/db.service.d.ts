import type { Lead, RawLead, Stats } from '../../../../packages/shared/types';
declare class DbService {
    private supabase;
    init(): void;
    private getClient;
    getLeads(filters: {
        status?: string;
        city?: string;
        vertical?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        leads: Lead[];
        total: number;
        page: number;
    }>;
    getLeadById(id: string): Promise<Lead | null>;
    insertLead(lead: RawLead): Promise<Lead>;
    importLeads(leads: RawLead[]): Promise<{
        imported: number;
        skipped: number;
    }>;
    updateLeadStatus(id: string, status: string): Promise<Lead>;
    updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;
    getStats(): Promise<Stats>;
    getDistinctCities(): Promise<string[]>;
    getDistinctVerticals(): Promise<{
        vertical: string;
        count: number;
    }[]>;
    getSettings(): {
        business_hours: {
            start: string;
            end: string;
            timezone: string;
            days: number[];
        };
        cities: never[];
        target_verticals: never[];
        target_provincias: never[];
        message_templates: {
            intro: string;
            followup_1: string;
            followup_2: string;
        };
        cooldown_minutes: number;
        daily_limit: number;
        warmup: {
            enabled: boolean;
            start_limit: number;
            duration_days: number;
        };
    };
    updateSettings(partial: any): any;
}
declare const dbService: DbService;
export { dbService };
//# sourceMappingURL=db.service.d.ts.map