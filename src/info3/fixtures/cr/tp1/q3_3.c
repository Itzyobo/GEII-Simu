#include "mcc_generated_files/mcc.h"
void main(void)
{
    SYSTEM_Initialize();
    while (1)
    {
        LED_D2_Toggle();
        __delay_ms(500);
    }
}
