import React, { useState, useEffect } from 'react';
import { Box, Grid } from '@mui/material';
import { useRouter } from 'next/router';
import { Skeleton } from '@mui/lab';
import { ArrowForwardIos } from '@mui/icons-material';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useEthPrice, useMaticPrice } from 'state/application/hooks';
import {
  getTopTokens,
  getGlobalData,
  getTopPairsV2,
  getGammaRewards,
  getGammaData,
} from 'utils';
import { GammaPairs, GlobalConst } from 'constants/index';
import { TokensTable, PairTable } from 'components';
import AnalyticsInfo from 'components/pages/analytics/AnalyticsInfo';
import AnalyticsLiquidityChart from 'components/pages/analytics/AnalyticsLiquidityChart';
import AnalyticsVolumeChart from 'components/pages/analytics/AnalyticsVolumeChart';
import { useTranslation } from 'next-i18next';
import {
  getGlobalDataV3,
  getGlobalDataTotal,
  getPairsAPR,
  getTopPairsV3,
  getTopTokensV3,
  getTopTokensTotal,
  getTopPairsTotal,
} from 'utils/v3-graph';
import { useDispatch } from 'react-redux';
import { setAnalyticsLoaded } from 'state/analytics/actions';
import { useActiveWeb3React } from 'hooks';

dayjs.extend(utc);

const AnalyticsOverview: React.FC = () => {
  const { t } = useTranslation();
  const { chainId } = useActiveWeb3React();
  const router = useRouter();
  const [globalData, updateGlobalData] = useState<any>(null);
  const [topTokens, updateTopTokens] = useState<any[] | null>(null);
  const [topPairs, updateTopPairs] = useState<any[] | null>(null);
  const [liquidityChartLoaded, setLiquidityChartLoaded] = useState(false);
  const [volumeChartLoaded, setVolumeChartLoaded] = useState(false);
  const { ethPrice } = useEthPrice();
  const { maticPrice } = useMaticPrice();

  const dispatch = useDispatch();
  const version = router.query.version ?? 'total';

  useEffect(() => {
    (async () => {
      if (version === 'v3') {
        const data = await getGlobalDataV3();
        if (data) {
          updateGlobalData(data);
        }
      } else if (version === 'total') {
        if (ethPrice.price && ethPrice.oneDayPrice) {
          const data = await getGlobalDataTotal(
            ethPrice.price,
            ethPrice.oneDayPrice,
          );
          if (data) {
            updateGlobalData(data);
          }
        }
      } else if (ethPrice.price && ethPrice.oneDayPrice) {
        const data = await getGlobalData(ethPrice.price, ethPrice.oneDayPrice);
        if (data) {
          updateGlobalData(data);
        }
      }
    })();

    (async () => {
      if (version === 'v3') {
        if (maticPrice.price && maticPrice.oneDayPrice) {
          const data = await getTopTokensV3(
            maticPrice.price,
            maticPrice.oneDayPrice,
            GlobalConst.utils.ANALYTICS_TOKENS_COUNT,
          );
          if (data) {
            updateTopTokens(data);
          }
        }
      } else if (version === 'v2') {
        if (ethPrice.price && ethPrice.oneDayPrice) {
          const data = await getTopTokens(
            ethPrice.price,
            ethPrice.oneDayPrice,
            GlobalConst.utils.ANALYTICS_TOKENS_COUNT,
          );
          if (data) {
            updateTopTokens(data);
          }
        }
      } else {
        if (
          maticPrice.price &&
          maticPrice.oneDayPrice &&
          ethPrice.price &&
          ethPrice.oneDayPrice
        ) {
          const data = await getTopTokensTotal(
            ethPrice.price,
            ethPrice.oneDayPrice,
            maticPrice.price,
            maticPrice.oneDayPrice,
            GlobalConst.utils.ANALYTICS_TOKENS_COUNT,
          );
          if (data) {
            updateTopTokens(data);
          }
        }
      }
    })();

    (async () => {
      if (version === 'v3') {
        const pairsData = await getTopPairsV3(
          GlobalConst.utils.ANALYTICS_PAIRS_COUNT,
        );
        if (pairsData) {
          const data = pairsData.filter((item: any) => !!item);
          try {
            const aprs = await getPairsAPR(data.map((item: any) => item.id));
            const gammaRewards = await getGammaRewards(chainId);
            const gammaData = await getGammaData();

            updateTopPairs(
              data.map((item: any, ind: number) => {
                const gammaPairs =
                  GammaPairs[
                    item.token0.id.toLowerCase() +
                      '-' +
                      item.token1.id.toLowerCase()
                  ] ??
                  GammaPairs[
                    item.token1.id.toLowerCase() +
                      '-' +
                      item.token0.id.toLowerCase()
                  ];
                const gammaFarmAPRs = gammaPairs
                  ? gammaPairs.map((pair) => {
                      return {
                        title: pair.title,
                        apr:
                          gammaRewards &&
                          gammaRewards[pair.address.toLowerCase()] &&
                          gammaRewards[pair.address.toLowerCase()]['apr']
                            ? Number(
                                gammaRewards[pair.address.toLowerCase()]['apr'],
                              ) * 100
                            : 0,
                      };
                    })
                  : [];
                const gammaPoolAPRs = gammaPairs
                  ? gammaPairs.map((pair) => {
                      return {
                        title: pair.title,
                        apr:
                          gammaData &&
                          gammaData[pair.address.toLowerCase()] &&
                          gammaData[pair.address.toLowerCase()]['returns'] &&
                          gammaData[pair.address.toLowerCase()]['returns'][
                            'allTime'
                          ] &&
                          gammaData[pair.address.toLowerCase()]['returns'][
                            'allTime'
                          ]['feeApr']
                            ? Number(
                                gammaData[pair.address.toLowerCase()][
                                  'returns'
                                ]['allTime']['feeApr'],
                              ) * 100
                            : 0,
                      };
                    })
                  : [];
                const quickFarmingAPR = aprs[ind].farmingApr;
                const farmingApr = Math.max(
                  quickFarmingAPR ?? 0,
                  ...gammaFarmAPRs.map((item) => Number(item.apr ?? 0)),
                );
                const quickPoolAPR = aprs[ind].apr;
                const apr = Math.max(
                  quickPoolAPR ?? 0,
                  ...gammaPoolAPRs.map((item) => Number(item.apr ?? 0)),
                );
                return {
                  ...item,
                  apr,
                  farmingApr,
                  quickFarmingAPR,
                  quickPoolAPR,
                  gammaFarmAPRs,
                  gammaPoolAPRs,
                };
              }),
            );
          } catch (e) {
            console.log(e);
          }
        }
      } else if (version === 'v2') {
        if (ethPrice.price) {
          const pairsData = await getTopPairsV2(
            GlobalConst.utils.ANALYTICS_PAIRS_COUNT,
          );
          if (pairsData) {
            updateTopPairs(pairsData);
          }
        }
      } else {
        const pairsData = await getTopPairsTotal(
          GlobalConst.utils.ANALYTICS_PAIRS_COUNT,
        );
        if (pairsData) {
          const data = pairsData.filter((item: any) => !!item);
          try {
            const aprs = await getPairsAPR(data.map((item: any) => item.id));
            const gammaRewards = await getGammaRewards(chainId);
            const gammaData = await getGammaData();

            updateTopPairs(
              data.map((item: any, ind: number) => {
                const gammaPairs = item.isV3
                  ? GammaPairs[
                      item.token0.id.toLowerCase() + '-' + item.token1.id
                    ]
                  : undefined;
                const gammaFarmAPRs = gammaPairs
                  ? gammaPairs.map((pair) => {
                      return {
                        title: pair.title,
                        apr:
                          gammaRewards &&
                          gammaRewards[pair.address.toLowerCase()] &&
                          gammaRewards[pair.address.toLowerCase()]['apr']
                            ? Number(
                                gammaRewards[pair.address.toLowerCase()]['apr'],
                              ) * 100
                            : 0,
                      };
                    })
                  : [];
                const gammaPoolAPRs = gammaPairs
                  ? gammaPairs.map((pair) => {
                      return {
                        title: pair.title,
                        apr:
                          gammaData &&
                          gammaData[pair.address.toLowerCase()] &&
                          gammaData[pair.address.toLowerCase()]['returns'] &&
                          gammaData[pair.address.toLowerCase()]['returns'][
                            'allTime'
                          ] &&
                          gammaData[pair.address.toLowerCase()]['returns'][
                            'allTime'
                          ]['feeApr']
                            ? Number(
                                gammaData[pair.address.toLowerCase()][
                                  'returns'
                                ]['allTime']['feeApr'],
                              ) * 100
                            : 0,
                      };
                    })
                  : [];
                const quickFarmingAPR = aprs[ind].farmingApr;
                const farmingApr = Math.max(
                  quickFarmingAPR ?? 0,
                  ...gammaFarmAPRs.map((item) => Number(item.apr ?? 0)),
                );
                const quickPoolAPR = aprs[ind].apr;
                const apr = Math.max(
                  quickPoolAPR ?? 0,
                  ...gammaPoolAPRs.map((item) => Number(item.apr ?? 0)),
                );
                return {
                  ...item,
                  apr,
                  farmingApr,
                  quickFarmingAPR,
                  quickPoolAPR,
                  gammaFarmAPRs,
                  gammaPoolAPRs,
                };
              }),
            );
          } catch (e) {
            console.log(e);
          }
        }
      }
    })();
  }, [
    ethPrice.price,
    ethPrice.oneDayPrice,
    maticPrice.price,
    maticPrice.oneDayPrice,
    version,
    chainId,
  ]);

  useEffect(() => {
    updateGlobalData(null);
    updateTopPairs(null);
    updateTopTokens(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (
      globalData &&
      topTokens &&
      topPairs &&
      liquidityChartLoaded &&
      volumeChartLoaded
    ) {
      dispatch(setAnalyticsLoaded(true));
    } else {
      dispatch(setAnalyticsLoaded(false));
    }
  }, [
    globalData,
    topTokens,
    topPairs,
    dispatch,
    liquidityChartLoaded,
    volumeChartLoaded,
  ]);

  return (
    <Box width='100%' mb={3}>
      <Grid container spacing={4}>
        <Grid item xs={12} sm={12} md={6}>
          <Box className='panel' width={1}>
            <AnalyticsLiquidityChart
              globalData={globalData}
              setDataLoaded={setLiquidityChartLoaded}
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <Box className='analyticsVolumeChart panel'>
            <AnalyticsVolumeChart
              globalData={globalData}
              setDataLoaded={setVolumeChartLoaded}
            />
          </Box>
        </Grid>
      </Grid>
      <Box mt={4}>
        <Box className='flex flex-wrap panel'>
          {globalData ? (
            <AnalyticsInfo data={globalData} />
          ) : (
            <Skeleton width='100%' height={20} />
          )}
        </Box>
      </Box>
      <Box mt={4}>
        <Box className='flex items-center justify-between'>
          <Box className='headingWrapper'>
            <p className='weight-600'>{t('topTokens')}</p>
          </Box>
          <Box
            className='cursor-pointer headingWrapper'
            onClick={() => router.push(`/analytics/${version}/tokens`)}
          >
            <p className='weight-600'>{t('seeAll')}</p>
            <ArrowForwardIos />
          </Box>
        </Box>
      </Box>
      <Box mt={3} className='panel'>
        {topTokens ? (
          <TokensTable
            data={topTokens
              .sort((token1, token2) => {
                return token1.totalLiquidityUSD > token2.totalLiquidityUSD
                  ? -1
                  : 1;
              })
              .slice(0, 10)}
            showPagination={false}
          />
        ) : (
          <Skeleton variant='rectangular' width='100%' height={150} />
        )}
      </Box>
      <Box mt={4}>
        <Box className='flex items-center justify-between'>
          <Box className='headingWrapper'>
            <p className='weight-600'>{t('topPairs')}</p>
          </Box>
          <Box
            className='cursor-pointer headingWrapper'
            onClick={() => router.push(`/analytics/${version}/pairs`)}
          >
            <p className='weight-600'>{t('seeAll')}</p>
            <ArrowForwardIos />
          </Box>
        </Box>
      </Box>
      <Box mt={3} className='panel'>
        {topPairs ? (
          <PairTable
            data={topPairs
              .sort((pair1, pair2) => {
                const liquidity1 = pair1.trackedReserveUSD
                  ? pair1.trackedReserveUSD
                  : pair1.reserveUSD ?? 0;
                const liquidity2 = pair2.trackedReserveUSD
                  ? pair2.trackedReserveUSD
                  : pair2.reserveUSD ?? 0;
                return liquidity1 > liquidity2 ? -1 : 1;
              })
              .slice(0, 10)}
            showPagination={false}
          />
        ) : (
          <Skeleton variant='rectangular' width='100%' height={150} />
        )}
      </Box>
    </Box>
  );
};

export default AnalyticsOverview;
