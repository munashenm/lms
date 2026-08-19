export class UnsupportedOfficialApiProvider {
  async authenticate(): Promise<void> {
    throw new Error("An official DBE/Provincial SA-SAMS API is not configured.");
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        "No authorised SA-SAMS API credentials are configured. Use a school-authorised file export for now. An API connector can be added without changing LMS import mapping once DBE/PED access is available.",
    };
  }

  async getSchool(): Promise<Record<string, unknown>> {
    await this.authenticate();
    return {};
  }

  async getLearners(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async getEducators(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async getClasses(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async getSubjects(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async getAssessments(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async getAttendance(): Promise<Record<string, unknown>[]> {
    await this.authenticate();
    return [];
  }

  async sync(): Promise<{ imported: number }> {
    await this.authenticate();
    return { imported: 0 };
  }
}
