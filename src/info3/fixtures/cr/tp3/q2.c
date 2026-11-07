#include "mcc_generated_files/mcc.h"

void BP_S1_ISR(void);
void IT_Timer2(void);

volatile uint8_t cpt = 0;

void main(void) {
    SYSTEM_Initialize();

    TMR2_SetInterruptHandler(IT_Timer2);
    IOCBF4_SetInterruptHandler(BP_S1_ISR);

    INTERRUPT_GlobalInterruptEnable();
    INTERRUPT_PeripheralInterruptEnable();

    while (1) {}
}

void BP_S1_ISR(void) {
    cpt = (cpt + 1) & 0x0F;
    PORTA = (PORTA & 0x0F) | (cpt << 4);
}

void IT_Timer2(void) {
    if (BP_S2_GetValue() == 0) {
        cpt = (cpt - 1) & 0x0F;
        PORTA = (PORTA & 0x0F) | (cpt << 4);
    }
}