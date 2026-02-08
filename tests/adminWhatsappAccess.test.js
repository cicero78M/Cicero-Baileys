// Test to verify ADMIN_WHATSAPP users can access dirrequest and oprrequest
import { jest } from '@jest/globals';

// Mock environment before imports
process.env.ADMIN_WHATSAPP = '628123456789,628987654321';
process.env.JWT_SECRET = 'test-secret';

describe('ADMIN_WHATSAPP Access Control', () => {
  describe('isAdminWhatsApp function', () => {
    // Import after setting env
    let isAdminWhatsApp;
    
    beforeAll(async () => {
      const waHelper = await import('../src/utils/waHelper.js');
      isAdminWhatsApp = waHelper.isAdminWhatsApp;
    });

    test('should return true for admin numbers without @c.us suffix', () => {
      expect(isAdminWhatsApp('628123456789')).toBe(true);
      expect(isAdminWhatsApp('628987654321')).toBe(true);
    });

    test('should return true for admin numbers with @c.us suffix', () => {
      expect(isAdminWhatsApp('628123456789@c.us')).toBe(true);
      expect(isAdminWhatsApp('628987654321@c.us')).toBe(true);
    });

    test('should return false for non-admin numbers', () => {
      expect(isAdminWhatsApp('628111111111')).toBe(false);
      expect(isAdminWhatsApp('628222222222@c.us')).toBe(false);
    });

    test('should handle numbers with non-digit characters', () => {
      // The function strips non-digits, so these should match admin number 628123456789
      expect(isAdminWhatsApp('62-812-345-6789')).toBe(true);
      expect(isAdminWhatsApp('62 812 345 6789')).toBe(true);
      expect(isAdminWhatsApp('62(812)345-6789')).toBe(true);
    });

    test('should return false for empty or invalid input', () => {
      expect(isAdminWhatsApp('')).toBe(false);
      expect(isAdminWhatsApp(null)).toBe(false);
      expect(isAdminWhatsApp(undefined)).toBe(false);
    });
  });

  describe('Access Control Integration', () => {
    test('should verify waService.js imports isAdminWhatsApp', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const waServicePath = path.join(process.cwd(), 'src', 'service', 'waService.js');
      const waServiceContent = fs.readFileSync(waServicePath, 'utf-8');
      
      // Verify isAdminWhatsApp is imported
      expect(waServiceContent).toMatch(/import\s+{[^}]*isAdminWhatsApp[^}]*}\s+from/);
    });

    test('should verify oprrequest checks isAdminWhatsApp before other checks', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const waServicePath = path.join(process.cwd(), 'src', 'service', 'waService.js');
      const waServiceContent = fs.readFileSync(waServicePath, 'utf-8');
      
      // Find the oprrequest section
      const oprRequestMatch = waServiceContent.match(/text\.toLowerCase\(\)\s*===\s*["']oprrequest["']([\s\S]*?)(?=\n\s*if\s*\(text\.toLowerCase\(\)|$)/);
      expect(oprRequestMatch).toBeTruthy();
      
      if (oprRequestMatch) {
        const oprSection = oprRequestMatch[0];
        const adminCheckPos = oprSection.indexOf('isAdminWhatsApp');
        const operatorCheckPos = oprSection.indexOf('findByOperator');
        
        // isAdminWhatsApp should come before findByOperator
        expect(adminCheckPos).toBeGreaterThan(-1);
        expect(operatorCheckPos).toBeGreaterThan(-1);
        expect(adminCheckPos).toBeLessThan(operatorCheckPos);
      }
    });

    test('should verify dirrequest checks isAdminWhatsApp before other checks', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const waServicePath = path.join(process.cwd(), 'src', 'service', 'waService.js');
      const waServiceContent = fs.readFileSync(waServicePath, 'utf-8');
      
      // Find the dirrequest section
      const dirRequestMatch = waServiceContent.match(/text\.toLowerCase\(\)\s*===\s*["']dirrequest["']([\s\S]*?)(?=\n\s*if\s*\(text\.toLowerCase\(\)|$)/);
      expect(dirRequestMatch).toBeTruthy();
      
      if (dirRequestMatch) {
        const dirSection = dirRequestMatch[0];
        const adminCheckPos = dirSection.indexOf('isAdminWhatsApp');
        const operatorCheckPos = dirSection.indexOf('findByOperator');
        
        // isAdminWhatsApp should come before findByOperator
        expect(adminCheckPos).toBeGreaterThan(-1);
        expect(operatorCheckPos).toBeGreaterThan(-1);
        expect(adminCheckPos).toBeLessThan(operatorCheckPos);
      }
    });
  });

  describe('Configuration', () => {
    test('ADMIN_WHATSAPP should be loaded from environment', () => {
      expect(process.env.ADMIN_WHATSAPP).toBeDefined();
      expect(process.env.ADMIN_WHATSAPP).toBe('628123456789,628987654321');
    });

    test('ADMIN_WHATSAPP should support multiple numbers', () => {
      const adminNumbers = process.env.ADMIN_WHATSAPP.split(',');
      expect(adminNumbers).toHaveLength(2);
      expect(adminNumbers[0].trim()).toBe('628123456789');
      expect(adminNumbers[1].trim()).toBe('628987654321');
    });
  });
});
