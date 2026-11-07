#include "mcc_generated_files/mcc.h"

void IT_Timer2(void);
void main(void)
{
    SYSTEM_Initialize();

    PORTA = (PORTA & 0x0F) | 0x30;

    TMR2_SetInterruptHandler(IT_Timer2);

    INTERRUPT_GlobalInterruptEnable();
    INTERRUPT_PeripheralInterruptEnable();


    while (1)
    {}
}

void IT_Timer2(void)
{
    LED_D2_Toggle();
    LED_D3_Toggle();
    LED_D4_Toggle();
    LED_D5_Toggle();

    // PORTA ^= 0xF0
}