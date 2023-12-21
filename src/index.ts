import {
    $update,
    $query,
    Record,
    StableBTreeMap,
    match,
    Result,
    nat64,
    ic,
    Opt,
  } from "azle";
  import { v4 as uuidv4 } from "uuid";
  
  type Renter = Record<{
    renterId: string;
    renterUserId: string;
    rentTime: string;
    bicycleId: string;
  }>;
  
  type RenterPayload = Record<{
    rentTime: string;
    bicycleId: string;
  }>;
  
  type Bicycle = Record<{
    bicycleId: string;
    type: string;
    isAvailable: boolean;
    renterId: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
  }>;
  
  type BicyclePayload = Record<{
    type: string;
    isAvailable: boolean;
    renterId: string;
  }>;
  
  type User = Record<{
    userId: string;
    userName: string;
    userAddress: string;
    userAge: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
  }>;
  
  type UserPayload = Record<{
    userName: string;
    userAddress: string;
    userAge: string;
  }>;
  
  
  // Payload Validation function
  function validateUserPayload(payload: UserPayload): Result<void, string> {
    if (!payload.userName || !payload.userAddress || !payload.userAge) {
      return Result.Err("Missing required fields in the payload.");
    }
    return Result.Ok(undefined);
  }
  
  // Payload Validation function
  function validateBicyclePayload(payload: BicyclePayload): Result<void, string> {
    if (!payload.type || !payload.isAvailable || !payload.renterId) {
      return Result.Err("Missing required fields in the payload.");
    }
    return Result.Ok(undefined);
  }
  
  const renterDB = new StableBTreeMap<string, Renter>(0, 44, 1024);
  const bicycleDB = new StableBTreeMap<string, Bicycle>(1, 44, 1024);
  const userDB = new StableBTreeMap<string, User>(2, 44, 1024);
  
  $update
  export function createUser(payload: UserPayload): Result<User, string> {
    try {
      // Validate payload
      if (!payload.userName || !payload.userAddress || !payload.userAge) {
        return Result.Err("Missing required fields in the payload.");
      }
      // Validate UUID
      const uniqueUserId = uuidv4();
      
      const newUser: User = {
        userId: uniqueUserId,
        userName: payload.userName,
        userAddress: payload.userAddress,
        userAge: payload.userAge,
        updatedAt: Opt.None,
        createdAt: ic.time(),
      };
  
      userDB.insert(uniqueUserId, newUser);
  
      return Result.Ok(newUser);
    } catch (error) {
      return Result.Err(`Failed to create user: ${error}`);
    }
  }
  
  $update
  export function addBicycle(payload: BicyclePayload): Result<Bicycle, string> {
    try {
      // Validate payload
      if (!payload.type || !payload.isAvailable || !payload.renterId) {
        return Result.Err("Missing required fields in the payload.");
      }
      // Validate UUID
      const uniqueBicycleId = uuidv4();
      
      const newBicycle: Bicycle = {
        bicycleId: uniqueBicycleId,
        type: payload.type,
        isAvailable: payload.isAvailable,
        renterId: payload.renterId,
        updatedAt: Opt.None,
        createdAt: ic.time(),
      };
  
      bicycleDB.insert(uniqueBicycleId, newBicycle);
  
      return Result.Ok(newBicycle);
    } catch (error) {
      return Result.Err(`Failed to add bicycle: ${error}`);
    }
  }
  
  
  $update
  export function rentBicycle(userId: string, payload:RenterPayload): Result<Renter, string> {
    // Validate payload
    if (!payload.rentTime || payload.bicycleId) {
      return Result.Err("Missing required fields in the payload.");
    }
  
    if (!userId) {
      return Result.Err("Missing or Invalid userId.");
    }
  
    return match(userDB.get(userId), {
        Some: (user) => {
            const bicycleId = payload.bicycleId; // Assuming you want to generate a unique ID for each bicycle
            return match(bicycleDB.get(bicycleId), {
                Some: (bicycle) => {
                    if (!bicycle.isAvailable) {
                        return Result.Err<Renter, string>('Bicycle is currently unavailable.');
                    }
  
                    const uniqueRentId = uuidv4();
  
                    const newRent: Renter = {
                        renterId: uniqueRentId,
                        renterUserId: userId,
                        rentTime: payload.rentTime,
                        bicycleId: bicycleId,
                    };
  
                    renterDB.insert(uniqueRentId, newRent);
  
                    const updatedBicycle: Bicycle = {
                        ...bicycle,
                        isAvailable: false,
                        renterId: userId,
                    };
  
                    bicycleDB.insert(bicycleId, updatedBicycle);
  
                    return Result.Ok<Renter, string>(newRent);
                },
                None: () => Result.Err<Renter, string>('Bicycle does not exist.'),
            });
        },
        None: () => Result.Err<Renter, string>('User does not exist. Please create an account.'),
    });
  }
  
  $update
  export function returnBicycle(userId: string, bicycleId: string): Result<boolean, string> {
    
    if (!userId) {
      return Result.Err("Missing or Invalid userId.");
    }
  
    
    if (!bicycleId) {
      return Result.Err("Missing or Invalid userId.");
    }
  
    return match(bicycleDB.get(bicycleId), {
      Some: (bicycle) => {
        if (bicycle.renterId !== userId) {
          return Result.Err<boolean, string>('User does not have the right to return this bicycle.');
        }
  
        const updatedBicycle: Bicycle = {
          ...bicycle,
          isAvailable: true,
          renterId: "", // Set the renterId to an empty string or null based on your requirement
        };
  
        bicycleDB.insert(bicycleId, updatedBicycle);
  
        return Result.Ok<boolean, string>(true);
      },
      None: () => Result.Err<boolean, string>('Bicycle does not exist.'),
    });
  }
  
  
  
  
  globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },
  };
  