#include "mcc_generated_files/mcc.h"

void BP_S1_ISR(void);
void BP_S2_ISR(void);

uint8_t cpt=0;

void main(void)
{
    SYSTEM_Initialize();

    IOCBF4_SetInterruptHandler(BP_S1_ISR);
    IOCCF5_SetInterruptHandler(BP_S2_ISR);

    INTERRUPT_GlobalInterruptEnable();
    while (1)
    {}
}

void BP_S1_ISR(void)
{
    cpt = (cpt + 1) & 0x0F;
    PORTA = (PORTA & 0x0F) | (cpt<<4);
}

void BP_S2_ISR(void)
{
    cpt = (cpt - 1) & 0x0F;
    PORTA = (PORTA & 0x0F) | (cpt<<4);
}