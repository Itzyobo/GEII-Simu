#include "mcc_generated_files/mcc.h"
#define APPUYE 0
#define RELACHE 1
void Decale_Droite(uint8_t *PtrMotif);
void Decale_Gauche(uint8_t *PtrMotif);
void Decale_Droite(uint8_t *PtrMotif) {
    *PtrMotif = ((*PtrMotif << 1) | (*PtrMotif >> 3)) & 0x0F;
}
void Decale_Gauche(uint8_t *PtrMotif) {
    *PtrMotif = ((*PtrMotif >> 1) | (*PtrMotif << 3)) & 0x0F;
}
void main(void) {
    SYSTEM_Initialize();
    uint8_t Chenille = 0x00;
    uint8_t Tempo[3] = {2, 10, 20};
    uint8_t indextempo = 0;
    while (BP_S2_GetValue() == RELACHE) {
        if (BP_S1_GetValue() == APPUYE) {
            LED_D2_Toggle();
            while (BP_S1_GetValue() == APPUYE) {}
        }
    }
    __delay_ms(500);
    while (BP_S2_GetValue() == RELACHE) {
        if (BP_S1_GetValue() == APPUYE) {
            LED_D3_Toggle();
            while (BP_S1_GetValue() == APPUYE) {}
        }
    }
    __delay_ms(500);
    while (BP_S2_GetValue() == RELACHE) {
        if (BP_S1_GetValue() == APPUYE) {
            LED_D4_Toggle();
            while (BP_S1_GetValue() == APPUYE) {}
        }
    }
    __delay_ms(500);
    while (BP_S2_GetValue() == RELACHE) {
        if (BP_S1_GetValue() == APPUYE) {
            LED_D5_Toggle();
            while (BP_S1_GetValue() == APPUYE) {}
        }
    }
    Chenille = PORTA >> 4;
    while (1) {
        PORTA = (PORTA & 0x0F) | (Chenille << 4);
        if (BP_S2_GetValue() == APPUYE) {
            indextempo++;
            while (BP_S2_GetValue() == APPUYE) {
            }
        }
        if (indextempo >= 3) indextempo = 0;
        for (int i = 0; i < Tempo[indextempo]; i++) {
            __delay_ms(100);
        }
        if (BP_S1_GetValue() == 1) {
            Decale_Droite(&Chenille);
        } else {
            Decale_Gauche(&Chenille);
        }
    }
}
