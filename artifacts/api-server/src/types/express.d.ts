declare namespace Express {
  interface Request {
    adminAuth?: {
      authorized: boolean;
      isSuperAdmin: boolean;
      sectorAdmin?: {
        id: number;
        name: string;
        email: string;
        sectors: string[];
      };
    };
  }
}
