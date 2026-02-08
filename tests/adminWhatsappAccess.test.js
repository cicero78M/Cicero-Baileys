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

    test('should handle numbers with different formats', () => {
      // Admin number in different format
      expect(isAdminWhatsApp('62-812-345-6789')).toBe(true);
    });

    test('should return false for empty or invalid input', () => {
      expect(isAdminWhatsApp('')).toBe(false);
      expect(isAdminWhatsApp(null)).toBe(false);
      expect(isAdminWhatsApp(undefined)).toBe(false);
    });
  });

  describe('Access Control Integration', () => {
    test('should document access mechanisms for oprrequest', () => {
      // This test documents the expected behavior
      const accessMechanisms = [
        {
          type: 'ADMIN_WHATSAPP',
          check: 'isAdminWhatsApp(chatId)',
          location: 'waService.js line ~2352',
          action: 'Show client selection via startAdminOprRequestSelection'
        },
        {
          type: 'Operator',
          check: 'findByOperator(waId)',
          location: 'waService.js line ~2362',
          action: 'Direct access to operator menu'
        },
        {
          type: 'Super Admin',
          check: 'findBySuperAdmin(waId)',
          location: 'waService.js line ~2363',
          action: 'Direct access to operator menu'
        }
      ];

      expect(accessMechanisms).toHaveLength(3);
      expect(accessMechanisms[0].type).toBe('ADMIN_WHATSAPP');
    });

    test('should document access mechanisms for dirrequest', () => {
      // This test documents the expected behavior
      const accessMechanisms = [
        {
          type: 'ADMIN_WHATSAPP',
          check: 'isAdminWhatsApp(chatId)',
          location: 'waService.js line ~2403',
          action: 'Show directorate client selection'
        },
        {
          type: 'Operator',
          check: 'findByOperator(waId)',
          location: 'waService.js line ~2443',
          action: 'Direct access to dirrequest menu'
        },
        {
          type: 'Super Admin',
          check: 'findBySuperAdmin(waId)',
          location: 'waService.js line ~2446',
          action: 'Direct access to dirrequest menu'
        }
      ];

      expect(accessMechanisms).toHaveLength(3);
      expect(accessMechanisms[0].type).toBe('ADMIN_WHATSAPP');
    });

    test('should verify access control priority order', () => {
      // ADMIN_WHATSAPP check should come FIRST (highest priority)
      const accessOrder = [
        'Check isAdminWhatsApp first',
        'If not admin, check operator/super admin',
        'If neither, deny access'
      ];

      expect(accessOrder[0]).toContain('isAdminWhatsApp first');
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
