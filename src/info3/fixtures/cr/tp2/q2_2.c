#include "mcc_generated_files/mcc.h"

void main(void)
{
    SYSTEM_Initialize();

    while (1)
    {
        LED_D2_PORT = ENCB_GetValue();
        LED_D3_PORT = ENCA_GetValue();
    }
}